import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shape returned by merqo's get_or_create_vendor_profile / upsert_vendor_profile.
 * merqo owns this table's real generated types — this is a hand-written
 * mirror of the RPC contract, since merqo.* is outside stockkit's own
 * supabase gen types scope (schema: "stockkit").
 */
export type VendorProfile = {
  vendor_id: string;
  stall_name: string;
  social_links: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type MerqoSchema = {
  merqo: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_or_create_vendor_profile: {
        Args: { p_vendor_id: string; p_default_stall_name: string | null };
        Returns: VendorProfile;
      };
      patch_vendor_profile: {
        Args: {
          p_vendor_id: string;
          p_stall_name: string | null;
          p_social_links: Record<string, string> | null;
        };
        Returns: VendorProfile;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export async function getOrCreateVendorProfile<
  Db,
  SchemaName extends string & Exclude<keyof Db, '__InternalSupabase'>,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  vendorId: string,
  defaultStallName: string | null
): Promise<VendorProfile> {
  const merqoClient = supabase as unknown as SupabaseClient<MerqoSchema>;
  const { data, error } = await merqoClient.schema('merqo').rpc('get_or_create_vendor_profile', {
    p_vendor_id: vendorId,
    p_default_stall_name: defaultStallName,
  });
  if (error) {
    throw new Error(`get_or_create_vendor_profile failed: ${error.message}`);
  }
  return data;
}

/** Omitted fields retain their authoritative database value. */
export async function patchVendorProfile<
  Db,
  SchemaName extends string & Exclude<keyof Db, '__InternalSupabase'>,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  vendorId: string,
  patch: { stallName?: string; socialLinks?: Record<string, string> }
): Promise<VendorProfile> {
  const args = {
    p_vendor_id: vendorId,
    p_stall_name: patch.stallName ?? null,
    p_social_links: patch.socialLinks ?? null,
  };
  const client = supabase as unknown as SupabaseClient<MerqoSchema>;
  const { data, error } = await client.schema('merqo').rpc('patch_vendor_profile', args);
  if (error || !data)
    throw new Error(`patch_vendor_profile failed: ${error?.message ?? 'empty response'}`);
  return data;
}
