import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitSupportMessage } from './merqo-support';
import { submitVendorFeedback } from './merqo-vendor-feedback';
import { getOrCreateVendorProfile } from './merqo-vendor-profile';
import type { Database } from './types';
const rpc = vi.fn();
const schema = vi.fn(() => ({ rpc }));
const client = { schema } as unknown as SupabaseClient<Database, 'stockkit'>;
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: { vendor_id: 'vendor' }, error: null });
});
describe('shared Merqo RPC contracts', () => {
  it('fetches the caller profile using the shared schema and default name', async () => {
    expect(await getOrCreateVendorProfile(client, 'vendor', null)).toEqual({ vendor_id: 'vendor' });
    expect(schema).toHaveBeenCalledWith('merqo');
    expect(rpc).toHaveBeenCalledWith('get_or_create_vendor_profile', {
      p_vendor_id: 'vendor',
      p_default_stall_name: null,
    });
  });
  it('sends feedback including a cleared optional message', async () => {
    await submitVendorFeedback(client, 'stockkit', 9, null);
    expect(rpc).toHaveBeenCalledWith('submit_vendor_feedback', {
      p_kit_slug: 'stockkit',
      p_nps: 9,
      p_message: null,
    });
  });
  it('scopes support submissions to stockkit', async () => {
    await submitSupportMessage(client, 'account', 'Help');
    expect(rpc).toHaveBeenCalledWith('submit_support_message', {
      p_kit_slug: 'stockkit',
      p_category: 'account',
      p_body: 'Help',
    });
  });
  it('propagates RPC errors so callers can avoid false success', async () => {
    rpc.mockResolvedValue({ error: { message: 'denied' }, data: null });
    await expect(getOrCreateVendorProfile(client, 'vendor', 'Stall')).rejects.toThrow(
      'get_or_create_vendor_profile failed: denied'
    );
    await expect(submitVendorFeedback(client, 'stockkit', 5, null)).rejects.toThrow(
      'submit_vendor_feedback failed: denied'
    );
    await expect(submitSupportMessage(client, 'account', 'Help')).rejects.toThrow(
      'submit_support_message failed: denied'
    );
  });
});
