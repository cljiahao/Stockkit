import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  requireAdminMock,
  createServiceClientMock,
  fromMock,
  updateMock,
  updateEqMock,
  updateSelectMock,
  maybeSingleMock,
  insertMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  createServiceClientMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  insertMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/admin', () => ({ requireAdmin: requireAdminMock }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const VENDOR_ID = '11111111-1111-4111-8111-111111111111';

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireAdminMock.mockReset().mockResolvedValue({ user: { id: 'admin-1' } });

  updateSelectMock.mockReset().mockReturnValue({ maybeSingle: maybeSingleMock });
  updateEqMock.mockReset().mockReturnValue({ select: updateSelectMock });
  updateMock.mockReset().mockReturnValue({ eq: updateEqMock });
  maybeSingleMock.mockReset().mockResolvedValue({ data: { id: VENDOR_ID }, error: null });

  insertMock.mockReset().mockResolvedValue({ error: null });

  fromMock.mockReset().mockImplementation((table: string) => {
    if (table === 'admin_audit') return { insert: insertMock };
    return { update: updateMock };
  });

  createServiceClientMock.mockReset().mockResolvedValue({ from: fromMock });
  revalidatePathMock.mockReset();
});

describe('setVendorPlan', () => {
  it('updates the vendor plan, records an audit row, and revalidates the vendors page', async () => {
    const { setVendorPlan } = await import('./actions');

    const result = await setVendorPlan(formData({ vendorId: VENDOR_ID, plan: 'pro' }));

    expect(result).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('vendors');
    expect(updateMock).toHaveBeenCalledWith({ plan: 'pro' });
    expect(updateEqMock).toHaveBeenCalledWith('id', VENDOR_ID);
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      action: 'set_vendor_plan',
      target_id: VENDOR_ID,
      detail: { plan: 'pro' },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin/vendors');
  });

  it('rejects invalid input before touching the database', async () => {
    const { setVendorPlan } = await import('./actions');

    const result = await setVendorPlan(formData({ vendorId: 'not-a-uuid', plan: 'pro' }));

    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized plan value', async () => {
    const { setVendorPlan } = await import('./actions');

    const result = await setVendorPlan(formData({ vendorId: VENDOR_ID, plan: 'enterprise' }));

    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('returns a friendly error and logs when the update fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } });

    const { setVendorPlan } = await import('./actions');
    const result = await setVendorPlan(formData({ vendorId: VENDOR_ID, plan: 'pro' }));

    expect(result).toEqual({ success: false, error: 'Could not update vendor plan' });
    expect(logged).toHaveBeenCalledWith('setVendorPlan failed', 'connection reset');
    expect(insertMock).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('propagates requireAdmin rejecting a non-admin caller before any write', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));

    const { setVendorPlan } = await import('./actions');

    await expect(setVendorPlan(formData({ vendorId: VENDOR_ID, plan: 'pro' }))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });
});

describe('setPricing', () => {
  it('updates the pricing row, records an audit row, and revalidates both pages', async () => {
    const { setPricing } = await import('./actions');

    const result = await setPricing({ monthly_cents: 1999 });

    expect(result).toEqual({ success: true });
    expect(fromMock).toHaveBeenCalledWith('pricing');
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ monthly_cents: 1999 }));
    expect(updateEqMock).toHaveBeenCalledWith('id', 1);
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      action: 'set_pricing',
      target_id: null,
      detail: { monthly_cents: 1999 },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith('/admin');
    expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/plan');
  });

  it('rejects a negative price before touching the database', async () => {
    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: -100 });
    expect(result).toEqual({ success: false, error: 'Invalid input' });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it('rejects a price above MAX_MONEY_CENTS', async () => {
    const { MAX_MONEY_CENTS } = await import('@/lib/schemas');
    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: MAX_MONEY_CENTS + 1 });
    expect(result).toEqual({ success: false, error: 'Invalid input' });
  });

  it('returns a friendly error and logs when the update fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    updateEqMock.mockReturnValueOnce({ error: { message: 'connection reset' } });

    const { setPricing } = await import('./actions');
    const result = await setPricing({ monthly_cents: 1999 });

    expect(result).toEqual({ success: false, error: 'Could not update pricing' });
    expect(logged).toHaveBeenCalledWith('setPricing failed', 'connection reset');
    expect(insertMock).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('propagates requireAdmin rejecting a non-admin caller before any write', async () => {
    requireAdminMock.mockRejectedValueOnce(new Error('NEXT_NOT_FOUND'));
    const { setPricing } = await import('./actions');
    await expect(setPricing({ monthly_cents: 1999 })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });
});
