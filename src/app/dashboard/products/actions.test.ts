import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getUserMock,
  fromMock,
  selectMock,
  eqMock,
  headMock,
  existingMaybeSingleMock,
  insertMock,
  insertSelectMock,
  singleMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
  maybeSingleMock,
  rpcMock,
  createServerClientMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  headMock: vi.fn(),
  existingMaybeSingleMock: vi.fn(),
  insertMock: vi.fn(),
  insertSelectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  rpcMock: vi.fn(),
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
  // to { count, error } when awaited. `maybeSingle` is the same chain's other
  // terminal, used by the reactivation check's existing-row fetch
  // (`select('is_active').eq('id', ...).maybeSingle()`) — defaults to an
  // already-active row so most tests never trip the cap check by accident.
  eqMock.mockReset().mockReturnValue({
    eq: eqMock,
    single: singleMock,
    maybeSingle: existingMaybeSingleMock,
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
      headMock().then(resolve, reject),
  });
  headMock.mockReset().mockResolvedValue({ count: 0, error: null });
  existingMaybeSingleMock.mockReset().mockResolvedValue({ data: { is_active: true }, error: null });
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

  rpcMock.mockReset().mockResolvedValue({ data: { id: 'p1' }, error: null });

  createServerClientMock.mockReset().mockResolvedValue({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
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

  it('does not check the cap when editing a product that was already active', async () => {
    existingMaybeSingleMock.mockResolvedValueOnce({ data: { is_active: true }, error: null });

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

  it('does not check the cap when deactivating a product', async () => {
    const { saveProduct } = await import('./actions');
    const result = await saveProduct({
      ...freshProductRow(),
      is_active: false,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(result).toEqual({ success: true, productId: 'p1' });
    expect(existingMaybeSingleMock).not.toHaveBeenCalled();
    expect(headMock).not.toHaveBeenCalled();
  });

  it('rejects reactivating a product on Free once back at the cap', async () => {
    existingMaybeSingleMock.mockResolvedValueOnce({ data: { is_active: false }, error: null });
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });
    headMock.mockResolvedValue({ count: 20, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct({
      ...freshProductRow(),
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(result).toEqual({
      success: false,
      error: "You've hit the Free plan's 20-product limit. Upgrade to Pro for unlimited products.",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows reactivating a product on Free when under the cap', async () => {
    existingMaybeSingleMock.mockResolvedValueOnce({ data: { is_active: false }, error: null });
    singleMock.mockResolvedValueOnce({ data: { plan: 'free' }, error: null });
    headMock.mockResolvedValue({ count: 19, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct({
      ...freshProductRow(),
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(result).toEqual({ success: true, productId: 'p1' });
  });

  it('allows reactivating a product on Pro regardless of count', async () => {
    existingMaybeSingleMock.mockResolvedValueOnce({ data: { is_active: false }, error: null });
    singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
    headMock.mockResolvedValue({ count: 500, error: null });

    const { saveProduct } = await import('./actions');
    const result = await saveProduct({
      ...freshProductRow(),
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });

    expect(result).toEqual({ success: true, productId: 'p1' });
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

describe('recordStockMovement — error mapping', () => {
  const validInput = {
    product_id: '11111111-1111-4111-8111-111111111111',
    delta: -2,
    reason: 'waste' as const,
  };

  it('maps a below-zero rejection to a stock-level message', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'on_hand would fall below zero' } });

    const { recordStockMovement } = await import('./actions');
    const result = await recordStockMovement(validInput);

    expect(result).toEqual({ success: false, error: 'Not enough stock — check the quantity' });
  });

  it('maps an ownership rejection to "Product not found"', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'product not found or not owned' } });

    const { recordStockMovement } = await import('./actions');
    const result = await recordStockMovement(validInput);

    expect(result).toEqual({ success: false, error: 'Product not found' });
  });

  it('logs and returns a generic error for any other RPC failure', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: 'connection reset by peer' } });

    const { recordStockMovement } = await import('./actions');
    const result = await recordStockMovement(validInput);

    expect(result).toEqual({ success: false, error: 'Could not record stock movement' });
    expect(logged).toHaveBeenCalledWith('recordStockMovement failed', 'connection reset by peer');
    logged.mockRestore();
  });

  it('returns a generic error when the RPC succeeds but returns no product', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const { recordStockMovement } = await import('./actions');
    const result = await recordStockMovement(validInput);

    expect(result).toEqual({ success: false, error: 'Could not record stock movement' });
  });
});

describe('vendorEntitlement — fail-closed plan lookup', () => {
  it('degrades to Free and logs when the vendors plan lookup errors', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection reset by peer' },
    });

    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');

    // Fail-closed: a Pro vendor whose lookup hiccups is treated as Free, but
    // the outage is no longer silent.
    expect(result).toEqual({
      success: false,
      error: 'CSV export is a Pro feature. Upgrade to export your full stock history.',
    });
    expect(logged).toHaveBeenCalledWith(
      'vendorEntitlement plan lookup failed',
      'connection reset by peer'
    );
    logged.mockRestore();
  });
});

describe('exportProductMovementsCsv', () => {
  it('rejects a malformed product id before touching the database', async () => {
    const { exportProductMovementsCsv } = await import('./actions');
    const result = await exportProductMovementsCsv('not-a-uuid');

    expect(result).toEqual({ success: false, error: 'Invalid product' });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

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
