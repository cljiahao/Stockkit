import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { GET as metrics } from './metrics/route';
import { GET as activity } from './vendor-activity/route';
const m = vi.hoisted(() => ({ from: vi.fn(), listUsers: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: async () => ({
    from: m.from,
    auth: { admin: { listUsers: m.listUsers } },
  }),
}));
type Row = { id: string; vendor_id?: string; [key: string]: unknown };
const now = new Date().toISOString();
const filters: Array<[string, string, unknown]> = [];
function stub(tables: Record<string, Row[]>, failedTable?: string) {
  m.from.mockImplementation((table: string) => {
    let cursor: string | null = null;
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push([table, column, value]);
        return query;
      },
      order: (column: string, options: unknown) => {
        expect(column).toBe('id');
        expect(options).toEqual({ ascending: true });
        return query;
      },
      limit: () => query,
      gt: (column: string, value: string) => {
        expect(column).toBe('id');
        cursor = value;
        return query;
      },
      maybeSingle: async () => ({ data: tables[table]?.[0] ?? null, error: null }),
      then: (
        resolve: (value: { data: Row[] | null; error: { message: string } | null }) => void
      ) => {
        if (cursor && table === failedTable)
          return Promise.resolve({ data: null, error: { message: 'later page failed' } }).then(
            resolve
          );
        const rows = (tables[table] ?? [])
          .filter((row) => cursor === null || row.id > cursor)
          .slice(0, 1);
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return query;
  });
}
function req(route: string) {
  return new NextRequest('http://localhost/api/merqo/' + route, {
    headers: { Authorization: 'Bearer test-secret' },
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  filters.length = 0;
  process.env.MERQO_METRICS_SECRET = 'test-secret';
  m.listUsers.mockResolvedValue({
    data: { users: [{ id: 'v1', email: 'vendor@example.com' }] },
    error: null,
  });
});
const tables = {
  vendors: [{ id: 'v1', plan: 'pro', created_at: now }],
  products: [
    { id: 'p1', vendor_id: 'v1', unit_cost_cents: 100, on_hand: 1 },
    { id: 'p2', vendor_id: 'v1', unit_cost_cents: 200, on_hand: 2 },
  ],
  stock_movements: [
    { id: 'm1', vendor_id: 'v1', reason: 'restock', unit_cost_cents: 100, created_at: now },
    { id: 'm2', vendor_id: 'v1', reason: 'restock', unit_cost_cents: 200, created_at: now },
  ],
};
it('aggregates metrics past a one-row API cap', async () => {
  stub(tables);
  const response = await metrics(req('metrics'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ revenue_cents_all: 300, gmv_cents_30d: 500 });
});
it.each(['products', 'stock_movements'])('rejects later %s page failure', async (table) => {
  stub(tables, table);
  expect((await metrics(req('metrics'))).status).toBe(503);
});
it('keeps vendor scope on every activity page and includes late rows', async () => {
  stub(tables);
  const response = await activity(req('vendor-activity?email=vendor@example.com'));
  expect(response.status).toBe(200);
  expect((await response.json()).metrics).toEqual(
    expect.arrayContaining([
      { label: 'Products', value: '2' },
      { label: 'Stock movements (30d)', value: '2' },
    ])
  );
  for (const table of ['products', 'stock_movements']) {
    expect(filters.filter(([name]) => name === table)).toEqual(
      Array.from({ length: 3 }, () => [table, 'vendor_id', 'v1'])
    );
  }
});
it('rejects an incomplete activity collection', async () => {
  stub(tables, 'stock_movements');
  expect((await activity(req('vendor-activity?email=vendor@example.com'))).status).toBe(503);
});
