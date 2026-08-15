import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: createServiceClientMock,
}));

type ChainResult = { data?: unknown; error?: unknown; count?: number };

/**
 * A minimal chainable query-builder stand-in: every filter/shape method
 * (`select`/`order`/`limit`/`in`/`eq`) returns the same object, and the
 * object itself is thenable — mirroring how the real supabase-js builder
 * resolves to `{ data, error }` (or `{ count, error }` for a head-count
 * query) whichever chain link is awaited directly, with no separate
 * terminal method call in production code.
 */
function chain(result: ChainResult) {
  const obj = {
    select: vi.fn(() => obj),
    order: vi.fn(() => obj),
    limit: vi.fn(() => obj),
    in: vi.fn(() => obj),
    eq: vi.fn(() => obj),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: ChainResult) => void, reject: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return obj;
}

/** Builds a fromMock that dispatches to a canned chain per table name. */
function fromByTable(tables: Record<string, ChainResult>) {
  return vi.fn((table: string) => chain(tables[table] ?? { data: [], error: null }));
}

beforeEach(() => {
  createServiceClientMock.mockReset();
});

describe('platformTotals', () => {
  it('aggregates vendor plan counts, product active counts, and a head-count of movements', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        vendors: {
          data: [
            { id: 'v1', plan: 'free' },
            { id: 'v2', plan: 'pro' },
            { id: 'v3', plan: 'free' },
          ],
          error: null,
        },
        products: {
          data: [
            { id: 'p1', is_active: true },
            { id: 'p2', is_active: false },
            { id: 'p3', is_active: true },
          ],
          error: null,
        },
        stock_movements: { count: 42, error: null },
      }),
    });

    const { platformTotals } = await import('./admin-data');
    const totals = await platformTotals();

    expect(totals).toEqual({
      vendors: 3,
      freeVendors: 2,
      proVendors: 1,
      products: 3,
      activeProducts: 2,
      stockMovements: 42,
    });
  });

  it('throws a labeled error when the vendors read fails', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        vendors: { data: null, error: { message: 'connection reset' } },
        products: { data: [], error: null },
        stock_movements: { count: 0, error: null },
      }),
    });

    const { platformTotals } = await import('./admin-data');
    await expect(platformTotals()).rejects.toThrow('platformTotals: connection reset');
  });
});

describe('recentActivity', () => {
  it('resolves vendor and product names for the latest movements', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        stock_movements: {
          data: [
            {
              id: 'm1',
              delta: 5,
              reason: 'restock',
              created_at: '2026-08-01T00:00:00Z',
              vendor_id: 'v1',
              product_id: 'p1',
            },
            {
              id: 'm2',
              delta: -2,
              reason: 'waste',
              created_at: '2026-08-02T00:00:00Z',
              vendor_id: 'v2',
              product_id: 'p2',
            },
          ],
          error: null,
        },
        vendors: {
          data: [
            { id: 'v1', name: 'Kopi Stall' },
            { id: 'v2', name: 'Bakery' },
          ],
          error: null,
        },
        products: {
          data: [
            { id: 'p1', name: 'Kopi O' },
            { id: 'p2', name: 'Bread' },
          ],
          error: null,
        },
      }),
    });

    const { recentActivity } = await import('./admin-data');
    const activity = await recentActivity(15);

    expect(activity).toEqual([
      {
        id: 'm1',
        delta: 5,
        reason: 'restock',
        created_at: '2026-08-01T00:00:00Z',
        vendor_name: 'Kopi Stall',
        product_name: 'Kopi O',
      },
      {
        id: 'm2',
        delta: -2,
        reason: 'waste',
        created_at: '2026-08-02T00:00:00Z',
        vendor_name: 'Bakery',
        product_name: 'Bread',
      },
    ]);
  });

  it('returns an empty list without querying vendors/products when there are no movements', async () => {
    const fromMock = fromByTable({
      stock_movements: { data: [], error: null },
    });
    createServiceClientMock.mockResolvedValue({ from: fromMock });

    const { recentActivity } = await import('./admin-data');
    const activity = await recentActivity();

    expect(activity).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('stock_movements');
  });

  it('throws a labeled error when the movements read fails', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        stock_movements: { data: null, error: { message: 'timeout' } },
      }),
    });

    const { recentActivity } = await import('./admin-data');
    await expect(recentActivity()).rejects.toThrow('recentActivity: timeout');
  });
});

describe('listVendors', () => {
  it('counts each vendor’s products and sorts by name', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        vendors: {
          data: [
            { id: 'v2', name: 'Zebra Stall', plan: 'free', created_at: '2026-07-01T00:00:00Z' },
            { id: 'v1', name: 'Ant Stall', plan: 'pro', created_at: '2026-06-01T00:00:00Z' },
          ],
          error: null,
        },
        products: {
          data: [{ vendor_id: 'v1' }, { vendor_id: 'v1' }, { vendor_id: 'v2' }],
          error: null,
        },
      }),
    });

    const { listVendors } = await import('./admin-data');
    const vendors = await listVendors();

    expect(vendors).toEqual([
      {
        id: 'v1',
        name: 'Ant Stall',
        plan: 'pro',
        created_at: '2026-06-01T00:00:00Z',
        product_count: 2,
      },
      {
        id: 'v2',
        name: 'Zebra Stall',
        plan: 'free',
        created_at: '2026-07-01T00:00:00Z',
        product_count: 1,
      },
    ]);
  });

  it('defaults an unbought vendor to a zero product count', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        vendors: {
          data: [
            { id: 'v1', name: 'Solo Stall', plan: 'free', created_at: '2026-06-01T00:00:00Z' },
          ],
          error: null,
        },
        products: { data: [], error: null },
      }),
    });

    const { listVendors } = await import('./admin-data');
    const vendors = await listVendors();

    expect(vendors).toEqual([
      {
        id: 'v1',
        name: 'Solo Stall',
        plan: 'free',
        created_at: '2026-06-01T00:00:00Z',
        product_count: 0,
      },
    ]);
  });

  it('throws a labeled error when the products read fails', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        vendors: { data: [], error: null },
        products: { data: null, error: { message: 'boom' } },
      }),
    });

    const { listVendors } = await import('./admin-data');
    await expect(listVendors()).rejects.toThrow('listVendors: boom');
  });
});

describe('currentPricing', () => {
  it('returns the live pricing row', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        pricing: { data: { monthly_cents: 1999, currency: 'SGD' }, error: null },
      }),
    });

    const { currentPricing } = await import('./admin-data');
    const result = await currentPricing();

    expect(result).toEqual({ monthly_cents: 1999, currency: 'SGD' });
  });

  it('falls back to DEFAULT_PRICING when the row is missing', async () => {
    createServiceClientMock.mockResolvedValue({
      from: fromByTable({
        pricing: { data: null, error: null },
      }),
    });

    const { currentPricing } = await import('./admin-data');
    const { DEFAULT_PRICING } = await import('@/lib/pricing');
    const result = await currentPricing();

    expect(result).toEqual(DEFAULT_PRICING);
  });
});
