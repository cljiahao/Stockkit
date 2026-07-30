export type Tier = 'free' | 'pro';

/**
 * A vendor's resolved capabilities. `null` on a cap means unlimited —
 * `null` (not Infinity) so the object serializes cleanly across the
 * server->client boundary for gating UI. Mirrors qkit's src/lib/plan.ts
 * shape, sized to stockkit's 2 real gates.
 */
export interface Entitlement {
  tier: Tier;
  maxActiveProducts: number | null;
  movementHistoryLimit: number | null;
  csvExport: boolean;
}

const FREE: Entitlement = {
  tier: 'free',
  maxActiveProducts: 20,
  movementHistoryLimit: 10,
  csvExport: false,
};

const PRO: Entitlement = {
  tier: 'pro',
  maxActiveProducts: null,
  movementHistoryLimit: null,
  csvExport: true,
};

export const ENTITLEMENTS: Record<Tier, Entitlement> = { free: FREE, pro: PRO };

/**
 * Coerce an untrusted plan value to a known Tier. Anything that isn't
 * exactly 'pro' degrades to 'free', so gating never crashes on a bad or
 * missing value.
 */
export function normalizePlan(value: unknown): Tier {
  return value === 'pro' ? 'pro' : 'free';
}
