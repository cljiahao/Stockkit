import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, listUsersMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  listUsersMock: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({
    from: fromMock,
    auth: { admin: { listUsers: listUsersMock } },
  })),
}));

import { GET } from '@/app/api/merqo/vendor-activity/route';

function req(url: string, auth?: string) {
  return new NextRequest(url, { headers: auth ? { Authorization: auth } : {} });
}

type TableResults = {
  vendors?: { data: unknown; error: unknown };
  products?: { data: unknown; error: unknown };
  stock_movements?: { data: unknown; error: unknown };
};

function vendorsTableStub(result: { data: unknown; error: unknown }) {
  const maybeSingle = () => Promise.resolve(result);
  const eq = () => ({ maybeSingle });
  return { select: () => ({ eq }) };
}

function listTableStub(result: { data: unknown; error: unknown }) {
  const eq = () => Promise.resolve(result);
  return { select: () => ({ eq }) };
}

function mockTables(overrides: TableResults) {
  fromMock.mockImplementation((table: string) => {
    if (table === 'vendors') {
      return vendorsTableStub(overrides.vendors ?? { data: null, error: null });
    }
    return listTableStub(
      overrides[table as 'products' | 'stock_movements'] ?? { data: [], error: null }
    );
  });
}

describe('GET /api/merqo/vendor-activity (stockkit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_METRICS_SECRET = 'test-secret';
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: 'u1', email: 'vendor@business.sg' }] },
      error: null,
    });
    mockTables({});
  });

  function url(email = 'vendor@business.sg') {
    return `http://localhost/api/merqo/vendor-activity?email=${encodeURIComponent(email)}`;
  }

  it('401 when the bearer is missing', async () => {
    const res = await GET(req(url()));
    expect(res.status).toBe(401);
  });

  it('400 when email is missing', async () => {
    const res = await GET(req('http://localhost/api/merqo/vendor-activity', 'Bearer test-secret'));
    expect(res.status).toBe(400);
  });

  it('503 when the auth-users read fails', async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await GET(req(url(), 'Bearer test-secret'));
    expect(res.status).toBe(503);
  });

  it('404 when no auth user matches the email', async () => {
    const res = await GET(req(url('nobody@business.sg'), 'Bearer test-secret'));
    expect(res.status).toBe(404);
  });

  it('503 when the vendors read fails', async () => {
    mockTables({ vendors: { data: null, error: { message: 'boom' } } });
    const res = await GET(req(url(), 'Bearer test-secret'));
    expect(res.status).toBe(503);
  });

  it('404 when the vendor has no stockkit.vendors row at all', async () => {
    mockTables({ vendors: { data: null, error: null } });
    const res = await GET(req(url(), 'Bearer test-secret'));
    expect(res.status).toBe(404);
  });

  it('503 when the products/movements reads fail', async () => {
    mockTables({
      vendors: {
        data: { id: 'u1', plan: 'pro', created_at: new Date().toISOString() },
        error: null,
      },
      products: { data: null, error: { message: 'boom' } },
    });
    const res = await GET(req(url(), 'Bearer test-secret'));
    expect(res.status).toBe(503);
  });

  it('returns the full activity payload for an existing vendor', async () => {
    mockTables({
      vendors: {
        data: { id: 'u1', plan: 'pro', created_at: new Date().toISOString() },
        error: null,
      },
      products: { data: [{ id: 'p1', vendor_id: 'u1' }], error: null },
      stock_movements: {
        data: [{ vendor_id: 'u1', reason: 'restock', created_at: new Date().toISOString() }],
        error: null,
      },
    });

    const res = await GET(req(url(), 'Bearer test-secret'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.plan).toBe('pro');
    expect(body.status).toBe('healthy');
    expect(body.metrics).toEqual(
      expect.arrayContaining([
        { label: 'Products', value: '1' },
        { label: 'Stock movements (30d)', value: '1' },
      ])
    );
    expect(typeof body.lastActivityAt).toBe('string');
  });
});
