'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/admin';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/types';

/**
 * Append an admin-audit row. Best-effort: a hiccup here must not fail the
 * action it records, but it's logged so a broken trail stays visible.
 */
async function recordAudit(
  adminId: string,
  action: string,
  targetId: string | null,
  detail: Json
): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from('admin_audit').insert({
    admin_id: adminId,
    action,
    target_id: targetId,
    detail,
  });
  if (error) console.error('admin_audit insert failed', error.message);
}

const setVendorPlanSchema = z.object({
  vendorId: z.string().uuid(),
  plan: z.enum(['free', 'pro']),
});

/**
 * Set a vendor's plan directly. Admin-only: requireAdmin() 404s non-admins
 * before any write. Uses the service-role client (allowed in Server Actions)
 * because migration 0010 restricts `vendors.plan` writes to service_role —
 * no vendor can self-escalate their own plan column.
 */
export async function setVendorPlan(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = setVendorPlanSchema.safeParse({
    vendorId: formData.get('vendorId'),
    plan: formData.get('plan'),
  });
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const supabase = await createServiceClient();
  const { data: updated, error } = await supabase
    .from('vendors')
    .update({ plan: parsed.data.plan })
    .eq('id', parsed.data.vendorId)
    .select('id')
    .maybeSingle();
  if (error || !updated) {
    console.error('setVendorPlan failed', error?.message ?? 'no row updated');
    return { success: false, error: 'Could not update vendor plan' };
  }

  await recordAudit(user.id, 'set_vendor_plan', parsed.data.vendorId, { plan: parsed.data.plan });

  revalidatePath(PAGE_ROUTES.ADMIN_VENDORS);
  return { success: true };
}
