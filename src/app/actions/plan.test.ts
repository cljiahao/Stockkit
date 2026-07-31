import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, submitSupportMessageMock, createServerClientMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  submitSupportMessageMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: createServerClientMock,
}));
vi.mock('@/lib/merqo-support', () => ({
  submitSupportMessage: submitSupportMessageMock,
}));

beforeEach(() => {
  getUserMock.mockReset();
  submitSupportMessageMock.mockReset().mockResolvedValue(undefined);
  createServerClientMock.mockReset().mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('requestProUpgradeAction', () => {
  it('files a billing support message for the signed-in vendor', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: true });
    expect(submitSupportMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      'billing',
      'Requesting an upgrade to the Pro plan.'
    );
  });

  it('rejects when no vendor is signed in', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: false, error: 'Please sign in first' });
    expect(submitSupportMessageMock).not.toHaveBeenCalled();
  });

  it('returns a friendly error if the RPC throws', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'v1' } } });
    submitSupportMessageMock.mockRejectedValue(new Error('rpc down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { requestProUpgradeAction } = await import('./plan');
    const result = await requestProUpgradeAction();

    expect(result).toEqual({ success: false, error: 'Could not send your request' });
    consoleError.mockRestore();
  });
});
