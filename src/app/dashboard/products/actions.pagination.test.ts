import { beforeEach, expect, it, vi } from 'vitest';
import { exportProductMovementsCsv, getProductMovements } from './actions';
type Page = { data: unknown[] | null; error: { message: string } | null };
const m = vi.hoisted(() => ({
  create: vi.fn(),
  from: vi.fn(),
  page: vi.fn<() => Promise<Page>>(),
  plan: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  or: vi.fn(),
  eq: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: m.create,
  createServiceClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const productId = '11111111-1111-4111-8111-111111111111';
const timestamp = '2026-10-08T00:00:00.000Z';
const row = (id: string) => ({
  id,
  product_id: productId,
  vendor_id: 'vendor',
  created_at: timestamp,
  reason: 'adjustment',
  delta: -1,
  note: null,
});
const first = row('33333333-3333-4333-8333-333333333333');
const second = row('22222222-2222-4222-8222-222222222222');
beforeEach(() => {
  vi.resetAllMocks();
  m.plan.mockResolvedValue({ data: { plan: 'pro' }, error: null });
  m.page.mockResolvedValue({ data: [], error: null });
  const query = {
    select: vi.fn(),
    eq: m.eq,
    order: m.order,
    limit: m.limit,
    or: m.or,
    then: (resolve: (value: Page) => unknown, reject?: (reason: unknown) => unknown) =>
      m.page().then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  m.eq.mockReturnValue(query);
  m.order.mockReturnValue(query);
  m.limit.mockReturnValue(query);
  m.or.mockReturnValue(query);
  const vendor = { select: vi.fn(), eq: vi.fn(), single: m.plan };
  vendor.select.mockReturnValue(vendor);
  vendor.eq.mockReturnValue(vendor);
  m.from.mockImplementation((table: string) => (table === 'vendors' ? vendor : query));
  m.create.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: 'vendor' } } }) },
    from: m.from,
  });
});
it('exports every page despite server caps smaller than the requested page size', async () => {
  m.page
    .mockResolvedValueOnce({ data: [first], error: null })
    .mockResolvedValueOnce({ data: [second], error: null });
  expect(await exportProductMovementsCsv(productId)).toEqual({
    success: true,
    csv: `date,reason,delta,note\n${timestamp},adjustment,-1,\n${timestamp},adjustment,-1,`,
  });
  expect(m.page).toHaveBeenCalledTimes(3);
  expect(m.or).toHaveBeenCalledWith(
    `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${first.id})`
  );
  expect(m.order).toHaveBeenCalledWith('id', { ascending: false });
});
it('returns all Pro history and scopes each page to the requested product', async () => {
  m.page
    .mockResolvedValueOnce({ data: [first], error: null })
    .mockResolvedValueOnce({ data: [second], error: null });
  expect(await getProductMovements(productId)).toEqual({
    success: true,
    movements: [first, second],
  });
  expect(m.eq).toHaveBeenCalledTimes(3);
  expect(m.eq).toHaveBeenCalledWith('product_id', productId);
});
it('rejects the whole export when a later page fails instead of returning partial history', async () => {
  m.page
    .mockResolvedValueOnce({ data: [first], error: null })
    .mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  expect(await exportProductMovementsCsv(productId)).toEqual({
    success: false,
    error: 'Could not export history',
  });
});
it('keeps Free history capped at one ten-row request', async () => {
  m.plan.mockResolvedValue({ data: { plan: 'free' }, error: null });
  m.page.mockResolvedValueOnce({ data: [first], error: null });
  expect(await getProductMovements(productId)).toEqual({ success: true, movements: [first] });
  expect(m.limit).toHaveBeenCalledWith(10);
  expect(m.page).toHaveBeenCalledOnce();
  expect(m.or).not.toHaveBeenCalled();
});
it('exports a valid header for empty history', async () => {
  expect(await exportProductMovementsCsv(productId)).toEqual({
    success: true,
    csv: 'date,reason,delta,note',
  });
});
