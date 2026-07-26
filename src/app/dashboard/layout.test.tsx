import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, fromMock, createServerClientMock, resolveVendorNameMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  createServerClientMock: vi.fn(),
  resolveVendorNameMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('@/lib/vendor-name', () => ({
  resolveVendorName: resolveVendorNameMock,
}));

// No live Supabase project is configured in this environment (see AGENTS.md);
// publicEnv throws fast on missing env vars at *import* time — layout.tsx
// transitively imports dashboard-nav.tsx, which imports the browser Supabase
// client, so this needs isolating the same way dashboard-nav.dom.test.tsx does.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}));

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
  resolveVendorNameMock.mockReset();
  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('DashboardLayout', () => {
  it("passes resolveVendorName's shared-profile result to DashboardNav, not the local vendors.name", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'v1', user_metadata: { avatar_url: null } } },
    });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { name: 'Stale Local Name' } }),
        }),
      }),
    });
    resolveVendorNameMock.mockResolvedValue('Ah Huat Chicken Rice');

    const { default: DashboardLayout } = await import('./layout');
    const element = await DashboardLayout({ children: null });

    expect(resolveVendorNameMock).toHaveBeenCalledWith(expect.anything(), 'v1', 'Stale Local Name');
    const dashboardNav = (element.props.children as { props: { vendorName: string } }[])[0];
    expect(dashboardNav.props.vendorName).toBe('Ah Huat Chicken Rice');
  });
});
