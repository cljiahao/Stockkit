export interface PricingConfig {
  monthly_cents: number;
  currency: string;
}

/**
 * Fallback when the `pricing` row can't be read (network hiccup, RLS
 * misconfiguration, a pre-migration deploy window). Deliberately NOT
 * zeroed, unlike qkit's own DEFAULT_PRICING: qkit uses 0 to signal a real
 * "pre-Stripe beta, price genuinely unset" state its offer page branches
 * on. stockkit has no such beta framing — Pro is already a live, charged
 * tier — so a vendor hitting this fallback must still see a real price,
 * not $0.00/mo or a "Free" label on a page telling them they're on Pro.
 * Seeded to match the live migration value at introduction time
 * (supabase/migrations/0014_stockkit_pricing.sql). This is a defensive
 * fallback only, not synced automatically by future admin price edits —
 * the `pricing` row is always present after migration 0014 runs, so this
 * path should essentially never be hit in practice.
 */
export const DEFAULT_PRICING: PricingConfig = {
  monthly_cents: 1999,
  currency: 'SGD',
};
