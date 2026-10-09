import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateSocialLinks, updateStallName } from './actions';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getProfile: vi.fn(),
  upsert: vi.fn(),
  eq: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  create: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createServerClient: mocks.create }));
vi.mock('@/lib/merqo-vendor-profile', () => ({
  getOrCreateVendorProfile: mocks.getProfile,
  patchVendorProfile: mocks.upsert,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'vendor-a' } } });
  mocks.getProfile.mockResolvedValue({
    stall_name: 'Original',
    social_links: { website: 'https://example.com' },
  });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.create.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('profile actions', () => {
  it('rejects invalid inputs before database access', async () => {
    expect((await updateStallName({ name: '' })).success).toBe(false);
    expect((await updateSocialLinks({ website: 'broken' })).success).toBe(false);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('requires a signed-in vendor for both updates', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    expect(await updateStallName({ name: 'New' })).toEqual({
      success: false,
      error: 'Not signed in',
    });
    expect(await updateSocialLinks({ website: 'https://example.com' })).toEqual({
      success: false,
      error: 'Not signed in',
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it('trims the name, preserves links and syncs only the signed-in local row', async () => {
    expect(await updateStallName({ name: ' New ' })).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.anything(), 'vendor-a', { stallName: 'New' });
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith({ name: 'New' });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'vendor-a');
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
  });
  it('reports success after the shared write if the display cache sync fails', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'offline' } });
    expect(await updateStallName({ name: 'New' })).toEqual({ success: true });
    expect(console.error).toHaveBeenCalledWith('updateStallName local sync failed', 'offline');
  });
  it.each([new Error('unavailable'), 'unavailable'])(
    'handles shared profile write failure: %s',
    async (error) => {
      mocks.upsert.mockRejectedValue(error);
      expect(await updateStallName({ name: 'New' })).toEqual({
        success: false,
        error: 'Could not save stall name',
      });
      expect(await updateSocialLinks({})).toEqual({
        success: false,
        error: 'Could not save links',
      });
      expect(mocks.getProfile).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    }
  );
  it('does not sync local state when the shared update fails', async () => {
    mocks.upsert.mockRejectedValue(new Error('offline'));
    expect((await updateStallName({ name: 'New' })).success).toBe(false);
    expect((await updateSocialLinks({})).success).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('updates links while preserving the shared stall name', async () => {
    expect(await updateSocialLinks({ website: 'https://new.example' })).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.anything(), 'vendor-a', {
      socialLinks: { website: 'https://new.example' },
    });
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
  });
});

it('preserves shared-save success after a rejected local mirror', async () => {
  mocks.eq.mockRejectedValueOnce(new Error('network'));
  expect(await updateStallName({ name: 'New' })).toEqual({ success: true });
  expect(mocks.upsert).toHaveBeenCalled();
  expect(mocks.revalidate).toHaveBeenCalledWith('/dashboard', 'layout');
});
