import type { VendorPlan } from '@/lib/types';

export type VendorStatus = { active: true; plan: VendorPlan } | { active: false; plan: null };

/**
 * stockkit.vendors has no email column (id references auth.users(id)
 * directly), so the caller supplies the auth-user list (from
 * supabase.auth.admin.listUsers) alongside the vendors rows, and this pure
 * function does the two-step lookup — mirrors qkit/paykit's
 * merqo-vendor-status.ts resolveVendorStatus exactly.
 */
export function resolveVendorStatus(
  email: string,
  authUsers: { id: string; email: string | null }[],
  vendors: { id: string; plan: VendorPlan }[]
): VendorStatus {
  const key = email.toLowerCase();
  const user = authUsers.find((u) => u.email?.toLowerCase() === key);
  if (!user) return { active: false, plan: null };
  const vendor = vendors.find((v) => v.id === user.id);
  if (!vendor) return { active: false, plan: null };
  return { active: true, plan: vendor.plan };
}
