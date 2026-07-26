import type { SupabaseClient } from '@supabase/supabase-js';

import { getOrCreateVendorProfile } from './merqo-vendor-profile';

/**
 * The signed-in vendor's stall name, sourced from the shared
 * `merqo.vendor_profile.stall_name` — the same source of truth
 * `profile/page.tsx` reads. `localName` (stockkit's own `vendors.name`
 * column) is only a signup-time default: it seeds a lazily-created merqo
 * row when one doesn't exist yet, and is the fallback if the shared read
 * fails. Degrades rather than throwing — this backs `dashboard/layout.tsx`,
 * so a merqo hiccup shouldn't take down every dashboard page.
 */
export async function resolveVendorName<
  Db,
  SchemaName extends string & Exclude<keyof Db, '__InternalSupabase'>,
>(
  supabase: SupabaseClient<Db, SchemaName>,
  vendorId: string,
  localName: string | null
): Promise<string> {
  try {
    const profile = await getOrCreateVendorProfile(supabase, vendorId, localName);
    return profile.stall_name;
  } catch (err) {
    console.error(
      'resolveVendorName: shared vendor profile read failed',
      err instanceof Error ? err.message : err
    );
    return localName ?? 'Your stall';
  }
}
