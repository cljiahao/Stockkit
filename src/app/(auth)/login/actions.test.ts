import { beforeEach, expect, it, vi } from 'vitest';
import { completeSignup } from './actions';
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'vendor-a' } } }) },
    from: () => ({ upsert: mocks.upsert }),
    rpc: mocks.rpc,
  })),
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
});
it.each(['returned', 'rejected'])('keeps signup successful after %s sync failure', async (kind) => {
  if (kind === 'returned') mocks.rpc.mockResolvedValue({ error: { message: 'offline' } });
  else mocks.rpc.mockRejectedValue(new Error('offline'));
  expect(await completeSignup('Rice stall')).toEqual({ success: true });
  expect(mocks.upsert).toHaveBeenCalledWith({ id: 'vendor-a', name: 'Rice stall' });
});
it('does not mask a failed primary vendor write', async () => {
  mocks.upsert.mockResolvedValue({ error: { message: 'denied' } });
  expect((await completeSignup('Rice stall')).success).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('does not mask a rejected primary vendor write', async () => {
  mocks.upsert.mockRejectedValue(new Error('offline'));
  await expect(completeSignup('Rice stall')).rejects.toThrow('offline');
  expect(mocks.rpc).not.toHaveBeenCalled();
});
