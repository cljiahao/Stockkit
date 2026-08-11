import { beforeEach, describe, expect, it, vi } from 'vitest';

const { exchangeCodeForSessionMock, getUserMock, upsertMock, fromMock, createServerClientMock } =
  vi.hoisted(() => ({
    exchangeCodeForSessionMock: vi.fn(),
    getUserMock: vi.fn(),
    upsertMock: vi.fn(),
    fromMock: vi.fn(),
    createServerClientMock: vi.fn(),
  }));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

beforeEach(() => {
  exchangeCodeForSessionMock.mockReset();
  getUserMock.mockReset().mockResolvedValue({ data: { user: null } });
  upsertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({ upsert: upsertMock });
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { exchangeCodeForSession: exchangeCodeForSessionMock, getUser: getUserMock },
    from: fromMock,
  });
});

function req(url: string) {
  return new Request(url);
}

describe('GET /auth/callback', () => {
  it('redirects to /login?error=oauth when no code param is present', async () => {
    const { GET } = await import('./route');
    const res = await GET(req('http://localhost/auth/callback'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard by default on a successful exchange', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const res = await GET(req('http://localhost/auth/callback?code=abc'));
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('abc');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('redirects to a safe relative ?next= path on success', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const res = await GET(req('http://localhost/auth/callback?code=abc&next=/reset-password'));
    expect(res.headers.get('location')).toBe('http://localhost/reset-password');
  });

  it('falls back to /dashboard when ?next= is a protocol-relative open redirect (//evil.com)', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const res = await GET(req('http://localhost/auth/callback?code=abc&next=//evil.com'));
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('falls back to /dashboard when ?next= is an absolute URL', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    const { GET } = await import('./route');
    const res = await GET(
      req('http://localhost/auth/callback?code=abc&next=' + encodeURIComponent('https://evil.com'))
    );
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('redirects to /login?error=oauth when the code exchange fails', async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: { message: 'invalid code' } });
    const { GET } = await import('./route');
    const res = await GET(req('http://localhost/auth/callback?code=bad'));
    expect(res.headers.get('location')).toBe('http://localhost/login?error=oauth');
  });

  describe('vendor row self-heal', () => {
    it('upserts a vendors row from the OAuth profile name, ignoring duplicates', async () => {
      exchangeCodeForSessionMock.mockResolvedValue({ error: null });
      getUserMock.mockResolvedValue({
        data: { user: { id: 'v1', user_metadata: { full_name: 'Ah Huat' } } },
      });

      const { GET } = await import('./route');
      await GET(req('http://localhost/auth/callback?code=abc'));

      expect(fromMock).toHaveBeenCalledWith('vendors');
      expect(upsertMock).toHaveBeenCalledWith(
        { id: 'v1', name: 'Ah Huat' },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    });

    it("falls back to the 'name' metadata field, then a placeholder, when full_name is absent", async () => {
      exchangeCodeForSessionMock.mockResolvedValue({ error: null });
      getUserMock.mockResolvedValue({
        data: { user: { id: 'v1', user_metadata: { name: 'Ah Huat' } } },
      });

      const { GET } = await import('./route');
      await GET(req('http://localhost/auth/callback?code=abc'));
      expect(upsertMock).toHaveBeenCalledWith(
        { id: 'v1', name: 'Ah Huat' },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      getUserMock.mockResolvedValue({ data: { user: { id: 'v2', user_metadata: {} } } });
      await GET(req('http://localhost/auth/callback?code=abc'));
      expect(upsertMock).toHaveBeenLastCalledWith(
        { id: 'v2', name: 'Your stall' },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    });

    it('does not upsert when the code exchange fails', async () => {
      exchangeCodeForSessionMock.mockResolvedValue({ error: { message: 'invalid code' } });
      const { GET } = await import('./route');
      await GET(req('http://localhost/auth/callback?code=bad'));
      expect(getUserMock).not.toHaveBeenCalled();
      expect(fromMock).not.toHaveBeenCalled();
    });

    it('still redirects when the vendor row upsert fails', async () => {
      exchangeCodeForSessionMock.mockResolvedValue({ error: null });
      getUserMock.mockResolvedValue({
        data: { user: { id: 'v1', user_metadata: {} } },
      });
      upsertMock.mockResolvedValue({ error: { message: 'db unavailable' } });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { GET } = await import('./route');
      const res = await GET(req('http://localhost/auth/callback?code=abc'));

      expect(res.headers.get('location')).toBe('http://localhost/dashboard');
      expect(consoleError).toHaveBeenCalledWith('ensureVendorRow failed', 'db unavailable');
      consoleError.mockRestore();
    });
  });
});
