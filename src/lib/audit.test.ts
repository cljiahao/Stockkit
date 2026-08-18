import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServiceClientMock, fromMock, insertMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
  fromMock: vi.fn(),
  insertMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createServiceClient: createServiceClientMock }));

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null });
  fromMock.mockReset().mockReturnValue({ insert: insertMock });
  createServiceClientMock.mockReset().mockResolvedValue({ from: fromMock });
});

describe('recordAudit', () => {
  it('inserts an admin_audit row via the service-role client', async () => {
    const { recordAudit } = await import('./audit');

    await recordAudit('actor-1', 'delete_product', 'product-1', { name: 'Kopi O' });

    expect(fromMock).toHaveBeenCalledWith('admin_audit');
    expect(insertMock).toHaveBeenCalledWith({
      admin_id: 'actor-1',
      action: 'delete_product',
      target_id: 'product-1',
      detail: { name: 'Kopi O' },
    });
  });

  it('accepts a null target_id', async () => {
    const { recordAudit } = await import('./audit');

    await recordAudit('actor-1', 'set_pricing', null, { monthly_cents: 1999 });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ target_id: null }));
  });

  it('logs and does not throw when the insert fails', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertMock.mockResolvedValueOnce({ error: { message: 'connection reset' } });

    const { recordAudit } = await import('./audit');
    await expect(recordAudit('actor-1', 'delete_product', 'p1', {})).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith('admin_audit insert failed', 'connection reset');
    logged.mockRestore();
  });
});
