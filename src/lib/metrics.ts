import type { StockMovementReason, VendorPlan } from '@/lib/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors merqo's `metricsPayloadSchema` (../merqo/src/lib/metrics-schema.ts).
// Defined locally rather than imported — cross-repo runtime imports aren't
// available; contract test keeps this in lockstep with merqo's actual schema.
export type MetricsPayload = {
  product: string;
  generated_at: string;
  revenue_cents_30d: number;
  revenue_cents_all: number;
  gmv_cents_30d: number;
  active_vendors: number;
  orders_7d: number;
  orders_prev_7d: number;
  signups_7d: number;
  pro_vendors: number;
  total_vendors: number;
  pending_upgrade_requests: number;
  funnel: {
    signed_up: number;
    with_booth: number;
    with_order: number;
    pro: number;
  };
};

export type StockkitMetrics = Omit<MetricsPayload, 'product' | 'generated_at'>;

export type StockkitMetricsInput = {
  nowMs: number;
  vendors: { id: string; plan: VendorPlan; created_at: string }[];
  products: { id: string; vendor_id: string; unit_cost_cents: number; on_hand: number }[];
  movements: {
    vendor_id: string;
    reason: StockMovementReason;
    unit_cost_cents: number | null;
    created_at: string;
  }[];
};

/**
 * Maps stockkit's inventory domain onto merqo's qkit/paykit-shaped payload.
 * stockkit has no checkout/payment flow, so several fields are a best-fit
 * mapping onto the nearest inventory-side analog rather than a literal match
 * — see each field's own comment below.
 */
export function computeStockkitMetrics(input: StockkitMetricsInput): StockkitMetrics {
  const { nowMs, vendors, products, movements } = input;
  const cutoff7d = nowMs - 7 * MS_PER_DAY;
  const cutoff14d = nowMs - 14 * MS_PER_DAY;
  const cutoff30d = nowMs - 30 * MS_PER_DAY;

  const inWindow = (iso: string, gteMs: number, ltMs?: number) => {
    const t = Date.parse(iso);
    return t >= gteMs && (ltMs === undefined || t < ltMs);
  };

  const restocks = movements.filter((m) => m.reason === 'restock');
  // "Revenue" has no literal equivalent here — the closest revenue-like flow
  // is money a vendor actually spent restocking, i.e. the unit_cost_cents
  // recorded against each 'restock' movement.
  const revenue_cents_30d = restocks
    .filter((m) => inWindow(m.created_at, cutoff30d))
    .reduce((s, m) => s + (m.unit_cost_cents ?? 0), 0);
  const revenue_cents_all = restocks.reduce((s, m) => s + (m.unit_cost_cents ?? 0), 0);

  // gmv is a live snapshot of on-hand inventory value, not a 30d flow —
  // stockkit has no order/checkout volume for a real GMV, and this is the
  // closest fit for "value moving through the system".
  const gmv_cents_30d = products.reduce((s, p) => s + p.unit_cost_cents * p.on_hand, 0);

  const orders_7d = movements.filter((m) => inWindow(m.created_at, cutoff7d)).length;
  const orders_prev_7d = movements.filter((m) =>
    inWindow(m.created_at, cutoff14d, cutoff7d)
  ).length;

  const signups_7d = vendors.filter((v) => inWindow(v.created_at, cutoff7d)).length;

  const total_vendors = vendors.length;
  const pro_vendors = vendors.filter((v) => v.plan === 'pro').length;

  const vendorIdsWithProducts = new Set(products.map((p) => p.vendor_id));
  const with_booth = vendors.filter((v) => vendorIdsWithProducts.has(v.id)).length;

  const vendorIdsWithMovements = new Set(movements.map((m) => m.vendor_id));
  const with_order = vendors.filter((v) => vendorIdsWithMovements.has(v.id)).length;

  const vendorIdsActive30d = new Set(
    movements.filter((m) => inWindow(m.created_at, cutoff30d)).map((m) => m.vendor_id)
  );
  const active_vendors = vendors.filter((v) => vendorIdsActive30d.has(v.id)).length;

  return {
    revenue_cents_30d,
    revenue_cents_all,
    gmv_cents_30d,
    active_vendors,
    orders_7d,
    orders_prev_7d,
    signups_7d,
    pro_vendors,
    total_vendors,
    pending_upgrade_requests: 0,
    funnel: {
      signed_up: total_vendors,
      with_booth,
      with_order,
      pro: pro_vendors,
    },
  };
}
