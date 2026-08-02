-- 0012_product_reactivation_limit.sql
-- SECURITY: closes the reactivation half of the cap bypass that
-- 0011_product_limit_rls.sql's own comment flagged and deliberately left
-- open: create 20 active, deactivate one, create another (now at 20 active
-- + 1 inactive), then reactivate the deactivated one — 21 active, repeatable
-- without limit. 0011 only guarded INSERT; this guards is_active flipping
-- false→true on UPDATE. `saveProduct`'s update branch (src/app/dashboard/
-- products/actions.ts) has no app-level check at all on this path today —
-- this migration is therefore the only enforcement, not a backstop for one.
--
-- Same two-layer shape as 0011, adapted for UPDATE instead of INSERT:
--   1. a BEFORE UPDATE ... FOR EACH ROW trigger, which rejects the ordinary
--      one-row-at-a-time reactivation immediately with a friendly error,
--      before anything is written; and
--   2. an AFTER UPDATE ... FOR EACH STATEMENT trigger, which re-checks the
--      real post-statement total and is what actually guarantees the cap —
--      a multi-row `update products set is_active=true where id in (...)`
--      from the browser client hits the same per-statement-snapshot
--      invisibility 0011 documented for batched inserts, so layer 1 alone
--      cannot catch it. There's no batch-reactivate feature in the app
--      today, but RLS has to hold against the raw client, not just the UI.
--
-- Deliberately a separate function/trigger pair from 0011's, not a shared
-- one — migrations are append-only here (0011 isn't touched), and the two
-- transition-table names (`inserted_rows` vs `reactivated_rows`) can't
-- share a REFERENCING clause across an INSERT and an UPDATE trigger anyway
-- without one function serving both, which would couple two independently
-- reasoned-about migrations together for no real benefit.

-- ── Layer 1: fast single-row rejection ──────────────────────────────────────
-- Row-level, not RLS WITH CHECK: WITH CHECK only ever sees the proposed NEW
-- row, not OLD, so it cannot tell "this row was already active" (a normal
-- edit to an already-active product) apart from "this row is being
-- reactivated" (the case that needs gating) — the former must never be
-- blocked just because the vendor is already at/over cap on other rows.
-- A BEFORE ROW trigger gets both OLD and NEW directly.
CREATE OR REPLACE FUNCTION stockkit.enforce_reactivation_limit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = stockkit
AS $$
BEGIN
  IF NOT OLD.is_active AND NEW.is_active AND NOT stockkit.can_create_product(NEW.vendor_id) THEN
    RAISE EXCEPTION
      'active product limit exceeded: cannot reactivate, at the free plan cap'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_enforce_reactivation_limit_row ON stockkit.products;

CREATE TRIGGER products_enforce_reactivation_limit_row
  BEFORE UPDATE ON stockkit.products
  FOR EACH ROW
  EXECUTE FUNCTION stockkit.enforce_reactivation_limit_row();

-- ── Layer 2: the statement-level guarantee ──────────────────────────────────
-- Same recount-and-lock shape as 0011's enforce_product_limit(), just keyed
-- off the UPDATE statement's NEW-table transition relation instead of
-- INSERT's, and only for vendors whose row actually flipped false→true (a
-- batch that only edits names, say, has nothing to recheck).
CREATE OR REPLACE FUNCTION stockkit.enforce_reactivation_limit_statement()
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
    SELECT DISTINCT n.vendor_id
    FROM reactivated_rows n
    JOIN old_rows o ON o.id = n.id
    WHERE NOT o.is_active AND n.is_active
    ORDER BY n.vendor_id
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

DROP TRIGGER IF EXISTS products_enforce_reactivation_limit_statement ON stockkit.products;

CREATE TRIGGER products_enforce_reactivation_limit_statement
  AFTER UPDATE ON stockkit.products
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS reactivated_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION stockkit.enforce_reactivation_limit_statement();

-- ── EXECUTE grants ───────────────────────────────────────────────────────────
-- Neither function is directly callable regardless (both RETURN trigger, and
-- PostgREST does not expose trigger functions as RPC) — belt-and-braces,
-- matching 0011's revokes on its own trigger function.
REVOKE EXECUTE ON FUNCTION stockkit.enforce_reactivation_limit_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION stockkit.enforce_reactivation_limit_statement() FROM PUBLIC;
