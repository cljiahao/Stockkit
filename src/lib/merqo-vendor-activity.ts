import type { VendorPlan } from '@/lib/types';
import {
  buildVendorHealth,
  type ProductLite,
  type StockMovementLite,
  type VendorStatus,
} from '@/lib/vendor-health';

export type VendorActivityMetric = { label: string; value: string };

export type VendorActivity = {
  active: boolean;
  plan: VendorPlan;
  status: VendorStatus;
  metrics: VendorActivityMetric[];
  lastActivityAt: string | null;
};

/**
 * Pure aggregation behind GET /api/merqo/vendor-activity, once the route has
 * already resolved the vendor to an existing `stockkit.vendors` row (a 404
 * for a vendor who's never touched stockkit at all is the route's job, not
 * this function's — a missing row never reaches here). Reuses
 * `vendor-health.ts`'s `buildVendorHealth` for `status` instead of
 * duplicating its triage logic — the same map this route builds also backs
 * `/admin/vendors`. `products`/`movements` are pre-scoped to this one vendor.
 */
export function computeVendorActivity(
  vendor: { id: string; plan: VendorPlan; created_at: string },
  products: ProductLite[],
  movements: StockMovementLite[],
  nowMs: number
): VendorActivity {
  const health = buildVendorHealth(
    [{ id: vendor.id, created_at: vendor.created_at }],
    products,
    movements,
    nowMs
  ).get(vendor.id)!;

  return {
    active: true,
    plan: vendor.plan,
    status: health.status,
    metrics: [
      { label: 'Products', value: String(health.productCount) },
      { label: 'Stock movements (30d)', value: String(health.movements30d) },
      {
        label: 'Waste ratio (30d)',
        value: health.wasteRatio30d === null ? '—' : `${Math.round(health.wasteRatio30d * 100)}%`,
      },
    ],
    lastActivityAt: health.lastMovementAt,
  };
}
