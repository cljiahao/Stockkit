-- 0014_stockkit_pricing.sql
-- Admin-editable pricing so the vendor plan page can show a live price and
-- admins can tune it without a deploy. Single-row, id pinned to 1 — same
-- shape as qkit.pricing (qkit/supabase/migrations/0010_monetization.sql),
-- minus event_pass_cents: stockkit has no day-pass concept
-- (docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md's own
-- decision to keep per-day pricing qkit-only).
CREATE TABLE stockkit.pricing (
  id            INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_cents INT         NOT NULL DEFAULT 0,
  currency      TEXT        NOT NULL DEFAULT 'SGD',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeded at the raised price ($19.99/mo) directly — see
-- docs/business/2026-08-15-per-kit-pricing-rationale.md's stockkit section
-- for the rationale (Zoho Inventory $29/mo is the cheapest real comparator
-- found; this stays ~31% below it).
INSERT INTO stockkit.pricing (id, monthly_cents)
  VALUES (1, 1999)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE stockkit.pricing ENABLE ROW LEVEL SECURITY;

-- Prices aren't secret; a public read keeps the vendor plan page simple.
-- No write policy exists — writes go through the service-role setPricing
-- action only.
CREATE POLICY "pricing_public_select" ON stockkit.pricing
  FOR SELECT USING (true);

GRANT SELECT ON stockkit.pricing TO anon, authenticated;
GRANT ALL ON stockkit.pricing TO service_role;
