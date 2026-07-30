import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUserMock,
  fromMock,
  selectMock,
  eqMock,
  headMock,
  insertMock,
  insertSelectMock,
  singleMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
  maybeSingleMock,
  createServerClientMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  headMock: vi.fn(),
  insertMock: vi.fn(),
  insertSelectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function freshProductRow() {
  return {
    name: 'Kopi O',
    unit: 'unit',
    unit_cost_cents: 100,
    on_hand: 0,
    low_stock_threshold: 0,
    is_active: true,
  };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'v1' } } });

  // vendors plan lookup: from('vendors').select('plan').eq('id', ...).single()
  singleMock.mockReset().mockResolvedValue({ data: { plan: 'free' }, error: null });

  // Active-product count: from('products').select('id', {count:'exact', head:true})
  //   .eq('vendor_id', ...).eq('is_active', true). Real supabase-js resolves this
  // chain when the final call is *awaited directly* (no terminal method) — there's
  // no separate `.head()` call in production code. So `eqMock`'s return value is
  // made "thenable": awaiting it forwards to headMock()'s resolved value, letting
  // `.eq().eq()` both use the same mock while the whole expression still resolves
  // to { count, error } when awaited.
  eqMock.mockReset().mockReturnValue({
    eq: eqMock,
    single: singleMock,
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
      headMock().then(resolve, reject),
  });
  headMock.mockReset().mockResolvedValue({ count: 0, error: null });
  selectMock.mockReset().mockReturnValue({ eq: eqMock, single: singleMock });

  insertSelectMock.mockReset().mockReturnValue({ single: singleMock });
  insertMock.mockReset().mockReturnValue({ select: insertSelectMock });

  updateSelectMock.mockReset().mockReturnValue({ maybeSingle: maybeSingleMock });
  updateEqMock.mockReset().mockReturnValue({ select: updateSelectMock });
  updateMock.mockReset().mockReturnValue({ eq: updateEqMock });
  maybeSingleMock.mockReset().mockResolvedValue({ data: { id: 'p1' }, error: null });

  fromMock.mockReset().mockImplementation(() => ({
    select: selectMock,
    insert: insertMock,
    update: updateMock,
  }));

  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
  });
});

describe('saveProduct — active-product cap', () => {
  it('rejects a new product on Free once the vendor already has 20 active products', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 20, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({
      success: false,
      error: "You've hit the Free plan's 20-product limit. Upgrade to Pro for unlimited products.",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('allows a new product on Free when under the cap', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'free' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 19, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({ success: true, productId: 'p-new' });
  });

  it('allows unlimited new products on Pro regardless of count', async () => {
    singleMock
      .mockResolvedValueOnce({ data: { plan: 'pro' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'p-new' }, error: null });
    headMock.mockResolvedValue({ count: 500, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct(freshProductRow());

    expect(result).toEqual({ success: true, productId: 'p-new' });
  });

  it('never checks the cap when updating an existing product', async () => {
    const { saveProduct } = await import('./actions');
    // A valid UUID is required by productFormSchema's `id` field — the
    // returned productId comes from the mocked DB row (maybeSingleMock),
    // not from this input id, so 'p1' below still matches.
    const result = await saveProduct({
      ...freshProductRow(),
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(result).toEqual({ success: true, productId: 'p1' });
    expect(headMock).not.toHaveBeenCalled();
  });
});

describe('getProductMovements — plan-based history limit', () => {
  // vendorEntitlement's own from('vendors').select('plan').eq('id', ...).single()
  // call consumes the shared eqMock/selectMock before the stock_movements query
  // does, so the first eqMock() call (the vendor lookup) must still resolve to
  // something `.single()`-able, and only the *second* eqMock() call (the
  // movements query) gets the `.order()`-shaped return.
  it('caps at 10 rows on Free', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    eqMock.mockReturnValueOnce({ single: singleMock }).mockReturnValueOnce({ order: orderMock });

    const { getProductMovements } = await import('./actions');
    await getProductMovements('11111111-1111-4111-8111-111111111111');

    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('fetches unlimited rows on Pro (no .limit call)', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    eqMock.mockReturnValueOnce({ single: singleMock }).mockReturnValueOnce({ order: orderMock });

    const { getProductMovements } = await import('./actions');
    await getProductMovements('11111111-1111-4111-8111-111111111111');

    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('exportProductMovementsCsv', () => {
  it('rejects on Free with a friendly error', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({
      success: false,
      error: 'CSV export is a Pro feature. Upgrade to export your full stock history.',
    });
  });

  it('returns CSV content on Pro', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm1',
          created_at: '2026-07-01T00:00:00Z',
          reason: 'restock',
          delta: 5,
          note: null,
        },
      ],
      error: null,
    });
    eqMock.mockReturnValueOnce({ single: singleMock }).mockReturnValueOnce({ order: orderMock });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.csv).toContain('date,reason,delta,note');
      expect(result.csv).toContain('restock');
    }
  });

  it('escapes a note containing a comma so it does not shift columns', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm2',
          created_at: '2026-07-02T00:00:00Z',
          reason: 'restock',
          delta: 3,
          note: 'restocked, from supplier A',
        },
      ],
      error: null,
    });
    eqMock.mockReturnValueOnce({ single: singleMock }).mockReturnValueOnce({ order: orderMock });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({
      success: true,
      csv: 'date,reason,delta,note\n2026-07-02T00:00:00Z,restock,3,"restocked, from supplier A"',
    });
  });

  it('escapes a note containing embedded double quotes and a newline', async () => {
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    const orderMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm3',
          created_at: '2026-07-03T00:00:00Z',
          reason: 'adjustment',
          delta: -1,
          note: 'said "low" on\nsecond line',
        },
      ],
      error: null,
    });
    eqMock.mockReturnValueOnce({ single: singleMock }).mockReturnValueOnce({ order: orderMock });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({
      success: true,
      csv:
        'date,reason,delta,note\n' +
        '2026-07-03T00:00:00Z,adjustment,-1,"said ""low"" on\nsecond line"',
    });
  });
});
