import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './page';
const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { getUser: m.getUser }, from: m.from }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: 'v1' } } });
  m.order.mockResolvedValue({ data: null });
  m.eq.mockReturnValue({
    order: () => ({
      limit: () => ({
        gt: () => Promise.resolve({ data: [], error: null }),
        then: (resolve: (value: unknown) => void) => m.order().then(resolve),
      }),
    }),
  });
  m.select.mockReturnValue({ eq: m.eq });
  m.from.mockReturnValue({ select: m.select });
});
describe('inventory overview', () => {
  it('redirects signed-out callers without querying inventory', async () => {
    m.getUser.mockResolvedValue({ data: { user: null } });
    await expect(Page()).rejects.toThrow('redirect:/login');
    expect(m.from).not.toHaveBeenCalled();
  });
  it('guides vendors with no inventory to create a product', async () => {
    expect(renderToStaticMarkup(await Page())).toContain('Add your first product');
    expect(m.eq).toHaveBeenCalledWith('is_active', true);
  });
  it('calculates value and prioritizes out-of-stock over low stock', async () => {
    m.order.mockResolvedValue({
      data: [
        {
          id: 'low',
          name: 'Low coffee',
          on_hand: 2,
          unit_cost_cents: 500,
          low_stock_threshold: 2,
          unit: 'kg',
        },
        {
          id: 'out',
          name: 'Empty tea',
          on_hand: 0,
          unit_cost_cents: 300,
          low_stock_threshold: 1,
          unit: 'kg',
        },
        {
          id: 'ok',
          name: 'Healthy milk',
          on_hand: 10,
          unit_cost_cents: 200,
          low_stock_threshold: 2,
          unit: 'kg',
        },
      ],
    });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('30.00');
    expect(html).toContain('Needs attention');
    expect(html.indexOf('Empty tea')).toBeLessThan(html.indexOf('Low coffee'));
    expect(html).not.toContain('Healthy milk');
  });
  it('omits urgent alerts for healthy inventory', async () => {
    m.order.mockResolvedValue({
      data: [{ id: 'ok', name: 'Milk', on_hand: 10, unit_cost_cents: 200, low_stock_threshold: 2 }],
    });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('20.00');
    expect(html).not.toContain('Needs attention');
  });
});

it('surfaces inventory failures instead of suggesting the account is empty', async () => {
  m.order.mockResolvedValue({ data: null, error: { message: 'offline' } });
  await expect(Page()).rejects.toThrow('Could not load inventory');
});
