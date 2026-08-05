import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('@/lib/supabase/env', () => ({
  publicEnv: {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'publishable-key',
  },
}));

beforeEach(() => {
  getUserMock.mockReset();
  createServerClientMock.mockReset().mockReturnValue({
    auth: { getUser: getUserMock },
  });
});

function req(path: string) {
  return new NextRequest(new Request(`http://localhost${path}`));
}

describe('updateSession', () => {
  it('does not resolve a user for a public path', async () => {
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/'));
    expect(getUserMock).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
  });

  it('does not resolve a user for the login page', async () => {
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/login'));
    expect(getUserMock).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects /dashboard to /login when signed out', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/dashboard'));
    expect(getUserMock).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('passes /dashboard through when signed in', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/dashboard'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('resolves a user for /admin, same as /dashboard', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/admin'));
    expect(getUserMock).toHaveBeenCalled();
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects /admin to /login when signed out, same as /dashboard', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('resolves a user for nested /admin routes too', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const { updateSession } = await import('./middleware');
    await updateSession(req('/admin/vendors'));
    expect(getUserMock).toHaveBeenCalled();
  });

  it('degrades to unauthenticated and redirects when auth is unreachable', async () => {
    getUserMock.mockRejectedValue(new Error('network down'));
    const { updateSession } = await import('./middleware');
    const res = await updateSession(req('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });
});
