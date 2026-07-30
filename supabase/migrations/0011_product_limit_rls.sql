-- 0011_product_limit_rls.sql
-- SECURITY: enforces the Free plan's active-product cap in Postgres.
--
-- The cap previously lived only in the `saveProduct` server action, which is
-- two ways bypassable:
--   (a) products_vendor_all grants full CRUD to `authenticated`, so
--       `supabase.from('products').insert(...)` straight from the browser
--       client never runs the server action's check at all;
--   (b) even through the server action, the check counts only `is_active`
--       rows — so create 20 active, deactivate one, create another, then
--       reactivate the deactivated one, and the vendor is at 21 (repeatable).
--
-- This closes (a) and the insert half of (b) at the only layer that can't be
-- talked around. `saveProduct`'s check stays as a fast, friendly-error first
-- line of defence. Mirrors qkit's 0003_plans_and_booth_limit.sql.

-- ── Split products_vendor_all into per-command policies ──────────────────────
-- Permissive policies OR together, and a FOR ALL policy's USING/WITH CHECK
-- also governs INSERT — so the plan gate cannot be expressed while
-- products_vendor_all exists. SELECT/UPDATE/DELETE are reproduced verbatim
-- from 0007_rls_select_auth_uid.sql (which itself only rewrote 0001's
-- `auth.uid()` as a scalar subquery); only INSERT gains a new condition.
-- UPDATE keeps its WITH CHECK — that's what stops a product being re-pointed
-- at a foreign vendor_id.
DROP POLICY IF EXISTS "products_vendor_all" ON stockkit.products;

CREATE POLICY "products_vendor_select" ON stockkit.products
  FOR SELECT USING (vendor_id = (select auth.uid()));

CREATE POLICY "products_vendor_update" ON stockkit.products
  FOR UPDATE
  USING (vendor_id = (select auth.uid()))
  WITH CHECK (vendor_id = (select auth.uid()));

CREATE POLICY "products_vendor_delete" ON stockkit.products
  FOR DELETE USING (vendor_id = (select auth.uid()));

-- ── The plan gate ────────────────────────────────────────────────────────────
-- SECURITY DEFINER: reading stockkit.products from inside a policy ON
-- stockkit.products would otherwise raise "infinite recursion detected in
-- policy for relation products". Definer rights bypass RLS for the count and
-- the plan lookup. STABLE (not VOLATILE) so the planner may cache it within a
-- statement. search_path pinned to prevent schema hijacking.
--
-- The literal 20 mirrors ENTITLEMENTS.free.maxActiveProducts in
-- src/lib/plan.ts — that TypeScript constant is the source of truth for the
-- product cap; SQL can't import it, so the two must be changed together.
--
-- A vendor with no vendors row yields NULL for the plan lookup; NULL OR false
-- is NULL, which WITH CHECK treats as a failure — fail-closed, matching the
-- app layer's normalizePlan-degrades-to-free default.
CREATE OR REPLACE FUNCTION stockkit.can_create_product(p_vendor UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = stockkit
AS $$
  SELECT
    (SELECT plan FROM stockkit.vendors WHERE id = p_vendor) = 'pro'
    OR (
      SELECT count(*)
      FROM stockkit.products
      WHERE vendor_id = p_vendor AND is_active
    ) < 20;
$$;

CREATE POLICY "products_vendor_insert" ON stockkit.products
  FOR INSERT WITH CHECK (
    vendor_id = (select auth.uid())
    AND stockkit.can_create_product((select auth.uid()))
  );
