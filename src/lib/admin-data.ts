import { createServiceClient } from '@/lib/supabase/server';

export type PlatformTotals = {
  vendors: number;
  freeVendors: number;
  proVendors: number;
  products: number;
  activeProducts: number;
  stockMovements: number;
};

export type ActivityRow = {
  id: string;
  delta: number;
  reason: string;
  created_at: string;
  vendor_name: string | null;
  product_name: string | null;
};

export type VendorRow = {
  id: string;
  name: string;
  plan: 'free' | 'pro';
  created_at: string;
  product_count: number;
};

// The admin console spans every vendor, so it reads with the service-role
// client (RLS-exempt) rather than widening the per-vendor policies. Unlike
// loopkit, stockkit's vendors table already carries a `name` column, so
// there's no auth-email-resolution dance here — everything is aggregated in
// TS over flat reads, fine at this scale.

/** Platform-wide totals for the overview stat tiles. */
export async function platformTotals(): Promise<PlatformTotals> {
  const supabase = await createServiceClient();
  const [vendorsRes, productsRes, movementsRes] = await Promise.all([
    supabase.from('vendors').select('id, plan'),
    supabase.from('products').select('id, is_active'),
    supabase.from('stock_movements').select('id', { count: 'exact', head: true }),
  ]);
  if (vendorsRes.error) throw new Error(`platformTotals: ${vendorsRes.error.message}`);
  if (productsRes.error) throw new Error(`platformTotals: ${productsRes.error.message}`);
  if (movementsRes.error) throw new Error(`platformTotals: ${movementsRes.error.message}`);

  const vendors = vendorsRes.data ?? [];
  const products = productsRes.data ?? [];

  return {
    vendors: vendors.length,
    freeVendors: vendors.filter((v) => v.plan !== 'pro').length,
    proVendors: vendors.filter((v) => v.plan === 'pro').length,
    products: products.length,
    activeProducts: products.filter((p) => p.is_active).length,
    stockMovements: movementsRes.count ?? 0,
  };
}

/** The most recent stock movements across every vendor, named. */
export async function recentActivity(limit = 15): Promise<ActivityRow[]> {
  const supabase = await createServiceClient();
  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('id, delta, reason, created_at, vendor_id, product_id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`recentActivity: ${error.message}`);

  const vendorIds = [...new Set((movements ?? []).map((m) => m.vendor_id))];
  const nameByVendorId = new Map<string, string>();
  if (vendorIds.length) {
    const { data: vendors } = await supabase.from('vendors').select('id, name').in('id', vendorIds);
    for (const v of vendors ?? []) nameByVendorId.set(v.id, v.name);
  }

  const productIds = [...new Set((movements ?? []).map((m) => m.product_id))];
  const nameByProductId = new Map<string, string>();
  if (productIds.length) {
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    for (const p of products ?? []) nameByProductId.set(p.id, p.name);
  }

  return (movements ?? []).map((m) => ({
    id: m.id,
    delta: m.delta,
    reason: m.reason,
    created_at: m.created_at,
    vendor_name: nameByVendorId.get(m.vendor_id) ?? null,
    product_name: nameByProductId.get(m.product_id) ?? null,
  }));
}

/** Every vendor with their plan and product count, for the admin vendors table. */
export async function listVendors(): Promise<VendorRow[]> {
  const supabase = await createServiceClient();
  const [vendorsRes, productsRes] = await Promise.all([
    supabase.from('vendors').select('id, name, plan, created_at'),
    supabase.from('products').select('vendor_id'),
  ]);
  if (vendorsRes.error) throw new Error(`listVendors: ${vendorsRes.error.message}`);
  if (productsRes.error) throw new Error(`listVendors: ${productsRes.error.message}`);

  const vendors = vendorsRes.data ?? [];
  const products = productsRes.data ?? [];

  const counts = new Map<string, number>();
  for (const p of products) {
    counts.set(p.vendor_id, (counts.get(p.vendor_id) ?? 0) + 1);
  }

  return vendors
    .map((v) => ({
      id: v.id,
      name: v.name,
      plan: v.plan,
      created_at: v.created_at,
      product_count: counts.get(v.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
