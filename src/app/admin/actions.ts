'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import type { ActionResult } from '@/lib/action-result';
import { requireAdmin } from '@/lib/admin';
import { recordAudit } from '@/lib/audit';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { MAX_MONEY_CENTS } from '@/lib/schemas';
import { createServiceClient } from '@/lib/supabase/server';

const setVendorPlanSchema = z.object({
  vendorId: z.string().uuid(),
  plan: z.enum(['free', 'pro']),
});

const pricingFormSchema = z.object({
  monthly_cents: z.number().int().nonnegative().max(MAX_MONEY_CENTS),
});
export type PricingFormInput = z.infer<typeof pricingFormSchema>;

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

/**
 * Update the single pricing row shown on the vendor plan page. Admin-only:
 * requireAdmin() 404s non-admins before any write. Service-role client
 * because migration 0014 gives `pricing` no write policy — every write
 * goes through this action.
 */
export async function setPricing(input: PricingFormInput): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = pricingFormSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('pricing')
    .update({ monthly_cents: parsed.data.monthly_cents, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) {
    console.error('setPricing failed', error.message);
    return { success: false, error: 'Could not update pricing' };
  }

  await recordAudit(user.id, 'set_pricing', null, { monthly_cents: parsed.data.monthly_cents });

  revalidatePath(PAGE_ROUTES.ADMIN);
  revalidatePath(PAGE_ROUTES.PLAN);
  return { success: true };
}
