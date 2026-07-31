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
--
-- Enforcement is two-layered, deliberately:
--   1. a per-row RLS WITH CHECK (`products_vendor_insert`), which rejects the
--      ordinary one-row-at-a-time insert immediately and cheaply; and
--   2. an AFTER INSERT ... FOR EACH STATEMENT trigger, which re-checks the
--      real post-statement total and is what actually guarantees the cap.
-- Layer 1 alone is not sufficient — see the trigger's comment for why.

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

-- ── The cap itself ───────────────────────────────────────────────────────────
-- One function owns both the plan rule and the literal, so the RLS check and
-- the trigger below cannot drift apart. NULL means unlimited, mirroring
-- Entitlement.maxActiveProducts in src/lib/plan.ts (`null`, not Infinity).
--
-- The literal 20 mirrors ENTITLEMENTS.free.maxActiveProducts in
-- src/lib/plan.ts — that TypeScript constant is the source of truth for the
-- product cap; SQL can't import it, so the two must be changed together.
--
-- A vendor with no vendors row makes the plan sub-select NULL, and
-- `NULL = 'pro'` is NULL, which CASE treats as not-matched — so an unknown
-- vendor gets the Free cap, matching normalizePlan's degrade-to-free default.
-- (Such an insert can't reach here anyway: products.vendor_id is FK'd to
-- vendors.id, so it fails on the constraint regardless of what this returns.
-- The FK is what protects that case — not the boolean logic.)
--
-- SECURITY DEFINER: reading stockkit.vendors from a policy on
-- stockkit.products has to bypass RLS, and vendors_self_select would
-- otherwise hide the row from anyone but its owner. STABLE (not VOLATILE) so
-- the planner may cache it within a statement. search_path is pinned to
-- prevent schema hijacking; that clause plus SECURITY DEFINER also stop the
-- planner from inlining the body into a caller, which is what keeps the
-- definer's rights actually applying.
CREATE OR REPLACE FUNCTION stockkit.active_product_cap(p_vendor UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = stockkit
AS $$
  SELECT CASE
    WHEN (SELECT plan FROM stockkit.vendors WHERE id = p_vendor) = 'pro'
      THEN NULL::integer
    ELSE 20
  END;
$$;

-- ── Layer 1: the per-row RLS gate ────────────────────────────────────────────
-- SECURITY DEFINER again: reading stockkit.products from inside a policy ON
-- stockkit.products would otherwise raise "infinite recursion detected in
-- policy for relation products".
CREATE OR REPLACE FUNCTION stockkit.can_create_product(p_vendor UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = stockkit
AS $$
  SELECT
    stockkit.active_product_cap(p_vendor) IS NULL
    OR (
      SELECT count(*)
      FROM stockkit.products
      WHERE vendor_id = p_vendor AND is_active
    ) < stockkit.active_product_cap(p_vendor);
$$;

CREATE POLICY "products_vendor_insert" ON stockkit.products
  FOR INSERT WITH CHECK (
    vendor_id = (select auth.uid())
    AND stockkit.can_create_product((select auth.uid()))
  );

-- ── Layer 2: the statement-level backstop ────────────────────────────────────
-- A per-row WITH CHECK structurally cannot enforce an aggregate cap on a
-- multi-row INSERT. RLS checks each candidate row against the *statement's
-- own* snapshot, and rows inserted earlier in the same statement carry the
-- same cmin/curcid, so they are invisible to a later row's check. One
-- `insert into products values (...), (...) ... x30` from the browser client
-- therefore evaluates can_create_product 30 times and gets the same
-- pre-statement count (e.g. 0) every time — 30 passes, cap bypassed.
--
-- AFTER INSERT ... FOR EACH STATEMENT with a transition table (Postgres 10+)
-- runs once, after every row of the statement has landed and the command
-- counter has been advanced, so the recount below is the true post-statement
-- total. That is what makes the cap a guarantee rather than a heuristic;
-- layer 1 above is kept only because it rejects the common single-row case
-- immediately, with the same error, before any row is written.
--
-- FOR EACH STATEMENT rather than FOR EACH ROW: a row-level AFTER trigger
-- would also see the batch, but would re-run the aggregate count once per
-- inserted row (O(n) counts, plus n advisory-lock acquisitions) for an
-- answer that can only change once per statement.
--
-- The advisory lock closes the concurrent-statement variant of the same
-- bypass: two transactions each inserting 15 rows for a vendor at 0 would
-- otherwise both see 15 and both commit, landing on 30. Taking a per-vendor
-- transaction-scoped lock *before* the recount serialises them, so the
-- second one's count (a fresh snapshot, this being a VOLATILE function under
-- READ COMMITTED) includes the first one's now-committed rows and raises.
-- Vendors are locked in a deterministic order so two multi-vendor batches
-- can't deadlock against each other; under RLS a batch only ever contains
-- one vendor anyway, since vendor_id must equal auth.uid().
--
-- SECURITY DEFINER for the same reason as the functions above: it reads
-- vendors.plan and counts rows the calling vendor may not select. Trigger
-- functions are invoked by the trigger machinery, which does not re-check
-- EXECUTE at fire time (that is checked once, against the creator, at CREATE
-- TRIGGER), so the REVOKE below does not disarm it.
--
-- Raises 42501 (insufficient_privilege) rather than a check-violation code so
-- that hitting the cap looks identical to the client whether it was layer 1
-- or layer 2 that caught it — same SQLSTATE, same PostgREST 403.
CREATE OR REPLACE FUNCTION stockkit.enforce_product_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = stockkit
AS $$
DECLARE
  v_vendor uuid;
  v_cap    integer;
  v_active bigint;
BEGIN
  FOR v_vendor IN
    SELECT DISTINCT vendor_id FROM inserted_rows ORDER BY vendor_id
  LOOP
    v_cap := stockkit.active_product_cap(v_vendor);
    CONTINUE WHEN v_cap IS NULL;

    PERFORM pg_advisory_xact_lock(
      hashtext('stockkit.products.active_cap'), hashtext(v_vendor::text));

    SELECT count(*) INTO v_active
    FROM stockkit.products
    WHERE vendor_id = v_vendor AND is_active;

    IF v_active > v_cap THEN
      RAISE EXCEPTION
        'active product limit exceeded: % active, % allowed on the free plan',
        v_active, v_cap
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

-- REFERENCING NEW TABLE has to be declared here, on the trigger, not on the
-- function — the function takes no arguments and simply reads `inserted_rows`
-- as an ordinary relation, which exists only for the duration of this
-- trigger's execution.
DROP TRIGGER IF EXISTS products_enforce_active_cap ON stockkit.products;

CREATE TRIGGER products_enforce_active_cap
  AFTER INSERT ON stockkit.products
  REFERENCING NEW TABLE AS inserted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION stockkit.enforce_product_limit();

-- ── EXECUTE grants ───────────────────────────────────────────────────────────
-- Functions default to EXECUTE for PUBLIC, and `stockkit` is a
-- PostgREST-exposed schema — so without these revokes anyone, signed in or
-- not, could POST /rest/v1/rpc/can_create_product with an arbitrary vendor
-- UUID and learn whether that vendor is on Pro or under the cap.
-- `authenticated` genuinely needs EXECUTE on can_create_product: an RLS
-- policy expression runs as the querying role, so products_vendor_insert
-- would fail outright without it.
--
-- active_product_cap needs no grant at all — its only callers reach it from
-- inside SECURITY DEFINER bodies, where the privilege check is made against
-- the definer (this migration's runner), which owns it.
--
-- enforce_product_limit is not directly callable by anyone regardless: a
-- `RETURNS trigger` function invoked as a plain function raises "trigger
-- functions can only be called as triggers" (0A000), and PostgREST does not
-- expose trigger functions as RPC. The revoke is belt-and-braces.
REVOKE EXECUTE ON FUNCTION stockkit.active_product_cap(uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION stockkit.can_create_product(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stockkit.can_create_product(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION stockkit.enforce_product_limit() FROM PUBLIC;
