-- 0009_vendor_plan.sql
-- Free/Pro vendor tier. Default 'free' — every existing vendor stays Free
-- until manually upgraded (no self-serve billing yet, see
-- docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md).
ALTER TABLE stockkit.vendors
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro'));
