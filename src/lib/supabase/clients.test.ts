import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from './client';
import { createServerClient, createServiceClient } from './server';
const mocks = vi.hoisted(() => ({
  ssr: vi.fn(),
  browser: vi.fn(),
  cookies: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.ssr,
  createBrowserClient: mocks.browser,
}));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('./env', () => ({
  publicEnv: { supabaseUrl: 'https://test.invalid', supabasePublishableKey: 'public-test' },
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: mocks.getAll, set: mocks.set });
  mocks.getAll.mockReturnValue([{ name: 'session', value: 'user-session' }]);
});
afterEach(() => vi.unstubAllEnvs());
describe('Supabase adapters', () => {
  it('scopes browser clients to stockkit', () => {
    createClient();
    expect(mocks.browser).toHaveBeenCalledWith('https://test.invalid', 'public-test', {
      db: { schema: 'stockkit' },
    });
  });
  it('reads and writes the request cookies for a vendor client', async () => {
    await createServerClient();
    const options = mocks.ssr.mock.calls[0][2];
    expect(options.db).toEqual({ schema: 'stockkit' });
    expect(options.cookies.getAll()).toEqual([{ name: 'session', value: 'user-session' }]);
    options.cookies.setAll([{ name: 'refreshed', value: 'new', options: { httpOnly: true } }]);
    expect(mocks.set).toHaveBeenCalledWith('refreshed', 'new', { httpOnly: true });
  });
  it('tolerates cookie refresh in a read-only server component', async () => {
    mocks.set.mockImplementation(() => {
      throw new Error('read-only');
    });
    await createServerClient();
    expect(() =>
      mocks.ssr.mock.calls[0][2].cookies.setAll([{ name: 's', value: 'v', options: {} }])
    ).not.toThrow();
  });
  it('fails closed when no service key is configured', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', '');
    await expect(createServiceClient()).rejects.toThrow('Missing required environment variable');
    expect(mocks.ssr).not.toHaveBeenCalled();
  });
  it('never hydrates a privileged client from request cookies', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'synthetic-test-key');
    await createServiceClient();
    expect(mocks.cookies).not.toHaveBeenCalled();
    const [url, key, options] = mocks.ssr.mock.calls[0];
    expect([url, key]).toEqual(['https://test.invalid', 'synthetic-test-key']);
    expect(options.cookies.getAll()).toEqual([]);
    options.cookies.setAll([{ name: 's', value: 'v' }]);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(options.auth).toEqual({ autoRefreshToken: false, persistSession: false });
  });
});
