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
  createServiceClientMock,
  auditFromMock,
  auditInsertMock,
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
  createServiceClientMock: vi.fn(),
  auditFromMock: vi.fn(),
  auditInsertMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
  createServiceClient: createServiceClientMock,
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

  // recordAudit (src/lib/audit.ts) — service-role write of admin_audit,
  // exercised by archiveProduct.
  auditInsertMock.mockReset().mockResolvedValue({ error: null });
  auditFromMock.mockReset().mockReturnValue({ insert: auditInsertMock });
  createServiceClientMock.mockReset().mockResolvedValue({ from: auditFromMock });
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

function mockMovementPages(result: { data: unknown[]; error: null }) {
  let first = true;
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => query,
    or: () => query,
    then: (resolve: (value: typeof result) => unknown) => {
      const page = first ? result : { data: [], error: null };
      first = false;
      return Promise.resolve(page).then(resolve);
    },
  };
  fromMock.mockImplementation((table: string) =>
    table === 'vendors' ? { select: selectMock } : query
  );
}

describe('exportProductMovementsCsv', () => {
  it.each(['=1+1', '+SUM(1,2)', '-1+1', '@SUM(1,2)', '\t=1+1', '\r=1+1'])(
    'exports formula-like notes as text: %s',
    async (note) => {
      singleMock.mockResolvedValueOnce({ data: { plan: 'pro' }, error: null });
      const orderMock = vi.fn().mockResolvedValue({
        data: [{ created_at: '2026-07-01', reason: 'adjustment', delta: -1, note }],
        error: null,
      });
      mockMovementPages(await orderMock());
      const { exportProductMovementsCsv } = await import('./actions');
      const result = await exportProductMovementsCsv('11111111-1111-4111-8111-111111111111');
      expect(result.success).toBe(true);
      if (result.success) {
        const safeNote = "'" + note;
        const escaped = /[",\n\r]/.test(safeNote)
          ? '"' + safeNote.replace(/"/g, '""') + '"'
          : safeNote;
        expect(result.csv).toBe('date,reason,delta,note\n2026-07-01,adjustment,-1,' + escaped);
      }
    }
  );

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
    mockMovementPages(await orderMock());

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
    mockMovementPages(await orderMock());

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
    mockMovementPages(await orderMock());

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

describe('archiveProduct', () => {
  beforeEach(() => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'p1', name: 'Kopi O', on_hand: 3 },
      error: null,
    });
  });
  it('rejects a malformed product id before touching the database', async () => {
    const { archiveProduct } = await import('./actions');

    const result = await archiveProduct('not-a-uuid');

    expect(result).toEqual({ success: false, error: 'Invalid product' });
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('rejects when the caller is not authenticated', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } });

    const { archiveProduct } = await import('./actions');
    const result = await archiveProduct('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ success: false, error: 'Not authenticated' });
  });

  it('archives the product, records an admin_audit row for it, and revalidates', async () => {
    const { archiveProduct } = await import('./actions');

    const result = await archiveProduct('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ success: true });
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    expect(updateEqMock).toHaveBeenCalledWith('id', '11111111-1111-4111-8111-111111111111');
    expect(updateSelectMock).toHaveBeenCalledWith('id, name, on_hand');
    expect(createServiceClientMock).toHaveBeenCalled();
    expect(auditFromMock).toHaveBeenCalledWith('admin_audit');
    expect(auditInsertMock).toHaveBeenCalledWith({
      admin_id: 'v1',
      action: 'archive_product',
      target_id: '11111111-1111-4111-8111-111111111111',
      detail: { name: 'Kopi O', on_hand: 3 },
    });
  });

  it('returns "Product not found" when no row matches, and never records an audit row', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const { archiveProduct } = await import('./actions');
    const result = await archiveProduct('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ success: false, error: 'Product not found' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns a friendly error and never records an audit row when the archive fails', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'connection reset' },
    });

    const { archiveProduct } = await import('./actions');
    const result = await archiveProduct('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ success: false, error: 'Could not archive product' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('still reports success when the best-effort audit insert itself fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    auditInsertMock.mockResolvedValueOnce({ error: { message: 'connection reset' } });

    const { archiveProduct } = await import('./actions');
    const result = await archiveProduct('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ success: true });
    expect(logged).toHaveBeenCalledWith('admin_audit insert failed', 'connection reset');
    logged.mockRestore();
  });
});
