import { createServerClient } from '@/lib/supabase/server';

type VendorSupabaseClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Stamp `tour_seen_at = now()` on a vendor's own `vendors` row. Best-effort:
 * this is cosmetic, so a failure is logged but never surfaced — the worst
 * case is the tour shows once more. RLS scopes the update to the vendor's
 * own row (id = auth.uid()). Unlike paykit's `vendor_prefs` (which starts
 * with no row for any vendor and needs an upsert), stockkit's `vendors` row
 * always exists for a signed-in vendor, so this is a plain update.
 *
 * Shared by two callers: `src/app/dashboard/tour-actions.ts`'s
 * `markTourSeen` (the client-fired, fire-and-forget path) and
 * `src/app/dashboard/layout.tsx`'s own server render (the durable path —
 * see that file for why the client-fired path alone isn't reliable). Kept
 * in a plain (non-`'use server'`) module rather than inlined in
 * `tour-actions.ts` so `layout.tsx` can call it directly during SSR without
 * crossing a Server Action's client/server serialization boundary —
 * `dashboard-tour.tsx` (a Client Component) imports `markTourSeen` from
 * that file, which would pull this function into the client bundle graph
 * too if it lived there.
 */
export async function stampTourSeen(
  supabase: VendorSupabaseClient,
  vendorId: string
): Promise<void> {
  const { error } = await supabase
    .from('vendors')
    .update({ tour_seen_at: new Date().toISOString() })
    .eq('id', vendorId);

  if (error) console.error('markTourSeen failed', error.message);
}
