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

vi.mock('@/components/dashboard-tour', () => ({
  DashboardTour: () => null,
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

function mockVendorRow(data: { name: string; tour_seen_at?: string | null }) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data }),
      }),
    }),
  });
}

describe('DashboardLayout', () => {
  it("passes resolveVendorName's shared-profile result to DashboardNav, not the local vendors.name", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'v1', user_metadata: { avatar_url: null } } },
    });
    mockVendorRow({ name: 'Stale Local Name' });
    resolveVendorNameMock.mockResolvedValue('Ah Huat Chicken Rice');

    const { default: DashboardLayout } = await import('./layout');
    const element = await DashboardLayout({ children: null });

    expect(resolveVendorNameMock).toHaveBeenCalledWith(expect.anything(), 'v1', 'Stale Local Name');
    const header = (
      element.props.children as { props: { children: { props: { vendorName: string } } } }[]
    )[0];
    const dashboardNav = header.props.children;
    expect(dashboardNav.props.vendorName).toBe('Ah Huat Chicken Rice');
  });

  it('passes seen=false to DashboardTour when tour_seen_at is null', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'v1', user_metadata: {} } },
    });
    mockVendorRow({ name: 'Ah Huat', tour_seen_at: null });
    resolveVendorNameMock.mockResolvedValue('Ah Huat');

    const { default: DashboardLayout } = await import('./layout');
    const element = await DashboardLayout({ children: null });

    const children = element.props.children as { props: { seen?: boolean } }[];
    const dashboardTour = children[children.length - 1];
    expect(dashboardTour.props.seen).toBe(false);
  });

  it('passes seen=true to DashboardTour when tour_seen_at is set', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'v1', user_metadata: {} } },
    });
    mockVendorRow({ name: 'Ah Huat', tour_seen_at: '2026-01-01T00:00:00Z' });
    resolveVendorNameMock.mockResolvedValue('Ah Huat');

    const { default: DashboardLayout } = await import('./layout');
    const element = await DashboardLayout({ children: null });

    const children = element.props.children as { props: { seen?: boolean } }[];
    const dashboardTour = children[children.length - 1];
    expect(dashboardTour.props.seen).toBe(true);
  });

  it('wraps DashboardNav in a `display: contents` element, not a box-generating one', async () => {
    // @merqo/ui's DashboardNav renders its own sticky <header> internally.
    // Wrapping it in another box-generating element (e.g. this layout's old
    // own <header>) nests a <header> inside a <header> and breaks the inner
    // one's `position: sticky` (no room in its containing block to shift) —
    // the wrapper here must stay `contents` so it doesn't generate a box.
    getUserMock.mockResolvedValue({
      data: { user: { id: 'v1', user_metadata: { avatar_url: null } } },
    });
    mockVendorRow({ name: 'Ah Huat' });
    resolveVendorNameMock.mockResolvedValue('Ah Huat');

    const { default: DashboardLayout } = await import('./layout');
    const element = await DashboardLayout({ children: null });

    const wrapper = (element.props.children as { type: string; props: { className: string } }[])[0];
    expect(wrapper.type).toBe('div');
    expect(wrapper.props.className).toContain('contents');
    expect(wrapper.props.className).toContain('print:hidden');
  });
});
