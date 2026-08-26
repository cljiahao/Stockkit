import type { StockMovementReason } from '@/lib/types';

/**
 * Per-vendor health as a small set of banded statuses — not a synthetic 0-100
 * score. A banded status the admin can act on is more honest than false
 * precision. First matching rule wins, most-urgent first.
 */
export type VendorStatus =
  // a real waste-ratio anomaly in the trailing 30 days — a P/L signal
  | 'attention'
  // onboarding stalled, or has products but never logged a stock movement
  | 'stuck'
  // no stock movement in 14+ days after prior activity
  | 'quiet'
  // just signed up, still onboarding
  | 'new'
  // logged a stock movement recently
  | 'healthy';

export type VendorLite = { id: string; created_at: string };
export type ProductLite = { id: string; vendor_id: string };
export type StockMovementLite = {
  vendor_id: string;
  reason: StockMovementReason;
  created_at: string;
};

export type VendorHealthRow = {
  status: VendorStatus;
  productCount: number;
  totalMovements: number;
  movements30d: number;
  /** Waste-reason share of movements30d, or null when the 30d sample is too small to judge. */
  wasteRatio30d: number | null;
  lastMovementAt: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NEW_DAYS = 3;
const STUCK_DAYS = 3;
const QUIET_DAYS = 14;
const ATTENTION_WINDOW_DAYS = 30;
const ATTENTION_MIN_SAMPLE = 5;
const ATTENTION_WASTE_RATIO = 0.3;

const RANK: Record<VendorStatus, number> = {
  attention: 0,
  stuck: 1,
  quiet: 2,
  new: 3,
  healthy: 4,
};

/** Triage sort key for a status — lower is more urgent. */
export function statusRank(status: VendorStatus): number {
  return RANK[status];
}

type Signals = {
  createdAt: string;
  productCount: number;
  totalMovements: number;
  movements30d: number;
  wasteMovements30d: number;
  lastMovementAt: string | null;
};

function ageMs(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? nowMs - t : 0;
}

/**
 * Classify one vendor from its rolled-up signals. First match wins.
 *
 * stockkit has no vendor plan-change timestamp (unlike qkit's pass expiry),
 * so unlike qkit's "stuck" rule this never gates on plan — only on signup
 * age and whether any product/movement exists at all.
 */
export function vendorStatus(s: Signals, nowMs: number): VendorStatus {
  if (
    s.movements30d >= ATTENTION_MIN_SAMPLE &&
    s.wasteMovements30d / s.movements30d > ATTENTION_WASTE_RATIO
  ) {
    return 'attention';
  }

  const signedUpAgo = ageMs(s.createdAt, nowMs);
  if (
    (s.productCount === 0 && signedUpAgo >= STUCK_DAYS * MS_PER_DAY) ||
    (s.productCount > 0 && s.totalMovements === 0)
  ) {
    return 'stuck';
  }

  if (s.lastMovementAt && nowMs - Date.parse(s.lastMovementAt) <= QUIET_DAYS * MS_PER_DAY) {
    return 'healthy';
  }

  if (signedUpAgo < NEW_DAYS * MS_PER_DAY) return 'new';

  return 'quiet';
}

/**
 * Roll raw admin-overview rows into a per-vendor health map. Pure: no DB, no
 * clock. A product's stock movements cascade-delete with it (migration
 * 0001), so a vendor with zero products always has zero movements too.
 * O(products + movements + vendors).
 */
export function buildVendorHealth(
  vendors: VendorLite[],
  products: ProductLite[],
  movements: StockMovementLite[],
  nowMs: number
): Map<string, VendorHealthRow> {
  const productCount = new Map<string, number>();
  for (const p of products) {
    productCount.set(p.vendor_id, (productCount.get(p.vendor_id) ?? 0) + 1);
  }

  const cutoff30d = nowMs - ATTENTION_WINDOW_DAYS * MS_PER_DAY;
  const totalMovements = new Map<string, number>();
  const movements30d = new Map<string, number>();
  const wasteMovements30d = new Map<string, number>();
  const lastMovementAt = new Map<string, string>();

  for (const m of movements) {
    totalMovements.set(m.vendor_id, (totalMovements.get(m.vendor_id) ?? 0) + 1);
    const cur = lastMovementAt.get(m.vendor_id);
    if (!cur || m.created_at > cur) lastMovementAt.set(m.vendor_id, m.created_at);
    if (Date.parse(m.created_at) >= cutoff30d) {
      movements30d.set(m.vendor_id, (movements30d.get(m.vendor_id) ?? 0) + 1);
      if (m.reason === 'waste') {
        wasteMovements30d.set(m.vendor_id, (wasteMovements30d.get(m.vendor_id) ?? 0) + 1);
      }
    }
  }

  const out = new Map<string, VendorHealthRow>();
  for (const v of vendors) {
    const total30d = movements30d.get(v.id) ?? 0;
    const waste30d = wasteMovements30d.get(v.id) ?? 0;
    const status = vendorStatus(
      {
        createdAt: v.created_at,
        productCount: productCount.get(v.id) ?? 0,
        totalMovements: totalMovements.get(v.id) ?? 0,
        movements30d: total30d,
        wasteMovements30d: waste30d,
        lastMovementAt: lastMovementAt.get(v.id) ?? null,
      },
      nowMs
    );
    out.set(v.id, {
      status,
      productCount: productCount.get(v.id) ?? 0,
      totalMovements: totalMovements.get(v.id) ?? 0,
      movements30d: total30d,
      wasteRatio30d: total30d >= ATTENTION_MIN_SAMPLE ? waste30d / total30d : null,
      lastMovementAt: lastMovementAt.get(v.id) ?? null,
    });
  }
  return out;
}
