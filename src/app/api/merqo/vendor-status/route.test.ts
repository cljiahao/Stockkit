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

import { GET } from '@/app/api/merqo/vendor-status/route';

function req(url: string, auth?: string) {
  return new NextRequest(url, { headers: auth ? { Authorization: auth } : {} });
}

describe('GET /api/merqo/vendor-status (stockkit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_METRICS_SECRET = 'test-secret';
    listUsersMock.mockResolvedValue({
      data: { users: [{ id: 'u1', email: 'vendor@business.sg' }] },
      error: null,
    });
    fromMock.mockImplementation(() => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }));
  });

  it('401 when the bearer is missing', async () => {
    const res = await GET(req('http://localhost/api/merqo/vendor-status?email=v@business.sg'));
    expect(res.status).toBe(401);
  });

  it('400 when email is missing', async () => {
    const res = await GET(req('http://localhost/api/merqo/vendor-status', 'Bearer test-secret'));
    expect(res.status).toBe(400);
  });

  it('reports inactive for a vendor with no vendors row', async () => {
    const res = await GET(
      req('http://localhost/api/merqo/vendor-status?email=vendor@business.sg', 'Bearer test-secret')
    );
    expect(await res.json()).toEqual({ active: false, plan: null });
  });

  it('reports active with plan for a vendor with a vendors row', async () => {
    fromMock.mockImplementation(() => ({
      select: () => Promise.resolve({ data: [{ id: 'u1', plan: 'pro' }], error: null }),
    }));
    const res = await GET(
      req('http://localhost/api/merqo/vendor-status?email=vendor@business.sg', 'Bearer test-secret')
    );
    expect(await res.json()).toEqual({ active: true, plan: 'pro' });
  });

  it('503 when the auth-users read fails', async () => {
    listUsersMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await GET(
      req('http://localhost/api/merqo/vendor-status?email=vendor@business.sg', 'Bearer test-secret')
    );
    expect(res.status).toBe(503);
  });

  it('503 when the vendors read fails', async () => {
    fromMock.mockImplementation(() => ({
      select: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    }));
    const res = await GET(
      req('http://localhost/api/merqo/vendor-status?email=vendor@business.sg', 'Bearer test-secret')
    );
    expect(res.status).toBe(503);
  });
});
