import { describe, expect, it, vi } from 'vitest';

import { getOrCreateVendorProfile } from './merqo-vendor-profile';
import { resolveVendorName } from './vendor-name';

vi.mock('./merqo-vendor-profile', () => ({
  getOrCreateVendorProfile: vi.fn(),
}));

const mockGetOrCreateVendorProfile = vi.mocked(getOrCreateVendorProfile);

describe('resolveVendorName', () => {
  it('returns the shared vendor profile stall name', async () => {
    mockGetOrCreateVendorProfile.mockResolvedValueOnce({
      vendor_id: 'v1',
      stall_name: 'Ah Huat Chicken Rice',
      social_links: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    const result = await resolveVendorName({} as never, 'v1', 'Old Local Name');
    expect(result).toBe('Ah Huat Chicken Rice');
  });

  it('falls back to the local name when the shared read throws', async () => {
    mockGetOrCreateVendorProfile.mockRejectedValueOnce(new Error('merqo down'));

    const result = await resolveVendorName({} as never, 'v1', 'Local Name');
    expect(result).toBe('Local Name');
  });

  it('falls back to "Your stall" when both the shared read and local name are missing', async () => {
    mockGetOrCreateVendorProfile.mockRejectedValueOnce(new Error('merqo down'));

    const result = await resolveVendorName({} as never, 'v1', null);
    expect(result).toBe('Your stall');
  });
});
