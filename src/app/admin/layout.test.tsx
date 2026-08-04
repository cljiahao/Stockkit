import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireAdminMock, signOutMock, createServerClientMock, redirectMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  signOutMock: vi.fn(async () => ({ error: null })),
  createServerClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock('@/lib/admin', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: createServerClientMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/app/admin/admin-nav', () => ({ AdminNav: () => null }));

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue({ user: { id: 'admin-1' } });
  createServerClientMock.mockReset().mockResolvedValue({ auth: { signOut: signOutMock } });
  redirectMock.mockReset();
  signOutMock.mockReset().mockResolvedValue({ error: null });
});

type Element = { type: unknown; props: Record<string, unknown> };

describe('AdminLayout', () => {
  it('gates the route via requireAdmin before rendering anything', async () => {
    const { default: AdminLayout } = await import('./layout');
    await AdminLayout({ children: null });
    expect(requireAdminMock).toHaveBeenCalled();
  });

  it('wraps children in the shared sticky header + content shell', async () => {
    const { default: AdminLayout } = await import('./layout');
    const element = (await AdminLayout({ children: 'page-content' })) as Element;

    const [header, content] = element.props.children as Element[];
    expect(header.type).toBe('header');
    expect(header.props.className as string).toContain('sticky');

    expect(content.props.className).toBe('flex-1');
    expect(content.props.children).toBe('page-content');
  });

  it('renders an Admin badge and a sign-out form whose action signs the user out and redirects to /login', async () => {
    const { default: AdminLayout } = await import('./layout');
    const element = (await AdminLayout({ children: null })) as Element;

    const [header] = element.props.children as Element[];
    const [topRow] = header.props.children as Element[];
    const [brandGroup, signOutForm] = topRow.props.children as Element[];

    const badge = (brandGroup.props.children as Element[])[1];
    expect(badge.props.children).toBe('Admin');

    expect(signOutForm.type).toBe('form');
    const action = signOutForm.props.action as () => Promise<void>;
    await action();

    expect(signOutMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
