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
