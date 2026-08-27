import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: fromMock })),
}));

const { getOrCreateVendorProfileMock } = vi.hoisted(() => ({
  getOrCreateVendorProfileMock: vi.fn(),
}));
vi.mock('@/lib/merqo-vendor-profile', () => ({
  getOrCreateVendorProfile: getOrCreateVendorProfileMock,
}));

const { recordAuditMock } = vi.hoisted(() => ({ recordAuditMock: vi.fn() }));
vi.mock('@/lib/audit', () => ({ recordAudit: recordAuditMock }));

import { POST } from '@/app/api/merqo/vendor-provision/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function req(body: unknown, auth?: string) {
  return new NextRequest('http://localhost/api/merqo/vendor-provision', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

function vendorsTable(
  insertResult: { error: { code?: string; message?: string } | null },
  selectResult: { data: { plan: string } | null; error: { message: string } | null }
) {
  const maybeSingle = () => Promise.resolve(selectResult);
  const eq = () => ({ maybeSingle });
  const select = () => ({ eq });
  const insert = () => Promise.resolve(insertResult);
  return () => ({ insert, select });
}

describe('POST /api/merqo/vendor-provision (stockkit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MERQO_PROVISION_SECRET = 'test-secret';
    getOrCreateVendorProfileMock.mockResolvedValue({ stall_name: 'Kopitiam Cart' });
    recordAuditMock.mockResolvedValue(undefined);
    fromMock.mockImplementation(
      vendorsTable({ error: null }, { data: { plan: 'free' }, error: null })
    );
  });

  it('401 when the bearer is missing', async () => {
    const res = await POST(req({ user_id: USER_ID }));
    expect(res.status).toBe(401);
  });

  it('400 on a malformed JSON body', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/merqo/vendor-provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-secret' },
        body: '{not valid json',
      })
    );
    expect(res.status).toBe(400);
  });

  it('400 when user_id fails schema validation', async () => {
    const res = await POST(req({ user_id: 'not-a-uuid' }, 'Bearer test-secret'));
    expect(res.status).toBe(400);
  });

  it('500 when the shared vendor-profile lookup fails', async () => {
    getOrCreateVendorProfileMock.mockRejectedValue(new Error('boom'));
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(500);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('inserts a new vendor row with the shared stall name, and audits it', async () => {
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, already_existed: false, plan: 'free' });
    expect(getOrCreateVendorProfileMock).toHaveBeenCalledWith(expect.anything(), USER_ID, null);
    expect(recordAuditMock).toHaveBeenCalledWith(USER_ID, 'merqo_vendor_provision', USER_ID, {
      actor: 'merqo_system',
      already_existed: false,
      plan: 'free',
    });
  });

  it('treats a unique-violation on insert as already_existed, not a failure', async () => {
    fromMock.mockImplementation(
      vendorsTable({ error: { code: '23505' } }, { data: { plan: 'pro' }, error: null })
    );
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, already_existed: true, plan: 'pro' });
  });

  it('400 Unknown user_id on a foreign-key violation', async () => {
    fromMock.mockImplementation(
      vendorsTable({ error: { code: '23503' } }, { data: null, error: null })
    );
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(400);
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('500 on an unexpected insert error', async () => {
    fromMock.mockImplementation(
      vendorsTable({ error: { message: 'connection reset' } }, { data: null, error: null })
    );
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(500);
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it('500 when the read-back after insert fails', async () => {
    fromMock.mockImplementation(
      vendorsTable({ error: null }, { data: null, error: { message: 'boom' } })
    );
    const res = await POST(req({ user_id: USER_ID }, 'Bearer test-secret'));
    expect(res.status).toBe(500);
    expect(recordAuditMock).not.toHaveBeenCalled();
  });
});
