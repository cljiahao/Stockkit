import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types';

/**
 * Append a row to `stockkit.admin_audit`. Best-effort: a hiccup here must
 * not fail the action it records, but it's logged so a broken trail stays
 * visible. Shared by every mutating action worth reconstructing or
 * disputing later — admin-level actions (e.g. `setVendorPlan`, `setPricing`
 * in `src/app/admin/actions.ts`) and vendor-level actions that destroy data
 * `stock_movements` can't reconstruct on its own (e.g. `deleteProduct` in
 * `src/app/dashboard/products/actions.ts`, which cascades away that
 * product's own ledger rows). `actorId` is always the caller's own
 * `auth.uid()` — an admin acting on someone else's data, or a vendor acting
 * on their own.
 */
export async function recordAudit(
  actorId: string,
  action: string,
  targetId: string | null,
  detail: Json
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from('admin_audit').insert({
    admin_id: actorId,
    action,
    target_id: targetId,
    detail,
  });
  if (error) console.error('admin_audit insert failed', error.message);
}
