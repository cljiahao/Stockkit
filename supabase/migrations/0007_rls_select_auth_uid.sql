-- Planner-cache auth.uid() in every stockkit-schema RLS policy. Postgres
-- re-evaluates a bare auth.uid() in a policy expression once PER ROW;
-- wrapping it in a scalar subquery (select auth.uid()) makes the planner
-- hoist it to a one-shot initPlan (evaluated once per query). The
-- expressions are otherwise semantically identical, so row-level isolation
-- is unchanged — the existing pgTAP suite re-exercises every policy below
-- and must still pass. Matches qkit's own retrofit
-- (0039_rls_select_auth_uid.sql).
--
-- Scope: stockkit-schema table policies only. The vendor-avatars bucket's
-- storage.objects policies (0006_vendor_avatars_bucket.sql) keep their bare
-- auth.uid() — a vendor evaluates them over a handful of image rows, so
-- there's no scan to optimize, matching qkit's own explicit scoping
-- decision for its equivalent booth-image policies.

-- ── vendors ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vendors_self_select" ON stockkit.vendors;
CREATE POLICY "vendors_self_select" ON stockkit.vendors
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "vendors_self_insert" ON stockkit.vendors;
CREATE POLICY "vendors_self_insert" ON stockkit.vendors
  FOR INSERT WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "vendors_self_update" ON stockkit.vendors;
CREATE POLICY "vendors_self_update" ON stockkit.vendors
  FOR UPDATE USING ((select auth.uid()) = id);

-- ── products ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "products_vendor_all" ON stockkit.products;
CREATE POLICY "products_vendor_all" ON stockkit.products
  FOR ALL
  USING (vendor_id = (select auth.uid()))
  WITH CHECK (vendor_id = (select auth.uid()));

-- ── stock_movements ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "stock_movements_vendor_select" ON stockkit.stock_movements;
CREATE POLICY "stock_movements_vendor_select" ON stockkit.stock_movements
  FOR SELECT USING (vendor_id = (select auth.uid()));

DROP POLICY IF EXISTS "stock_movements_vendor_insert" ON stockkit.stock_movements;
CREATE POLICY "stock_movements_vendor_insert" ON stockkit.stock_movements
  FOR INSERT WITH CHECK (vendor_id = (select auth.uid()));

-- ── feedback ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "feedback_self_insert" ON stockkit.feedback;
CREATE POLICY "feedback_self_insert" ON stockkit.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (vendor_id = (select auth.uid()));
