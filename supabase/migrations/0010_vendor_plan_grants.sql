-- 0010_vendor_plan_grants.sql
-- SECURITY: closes plan self-escalation on stockkit.vendors.
--
-- 0001 granted `authenticated` TABLE-level INSERT and UPDATE on
-- stockkit.vendors, and 0009 then added the `plan` column to that same table.
-- vendors_self_insert/vendors_self_update only check row ownership
-- (id = auth.uid()), never *which columns* are being written — so any
-- signed-in vendor could self-grant Pro straight from browser devtools:
--   createClient().from('vendors').update({ plan: 'pro' }).eq('id', myUserId)
-- and a vendor with no row yet (Google OAuth sign-ins never create one) could
-- ship `plan: 'pro'` along with their very first insert. The whole Free/Pro
-- tier system was bypassable.
--
-- A COLUMN-level GRANT is the only actual fix. Postgres cannot carve a single
-- column out of a TABLE-level grant, so the intuitive
-- `REVOKE UPDATE (plan) ... ` on top of a table-level `GRANT UPDATE` is a
-- silent no-op. Revoke the table-level privilege outright, then re-grant only
-- the columns the app genuinely writes. qkit hit and fixed the identical bug
-- in its 0042_grant_and_enum_fixes.sql.
--
-- `plan` is deliberately absent from both column lists below: it is now
-- writable only by service_role (`grant all`, 0001), i.e. by an admin
-- granting Pro manually — which is exactly the current billing model (no
-- self-serve billing; see
-- docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md).

-- ── UPDATE ───────────────────────────────────────────────────────────────────
-- Columns a vendor actually updates:
--   name          — dashboard/profile/actions.ts (updateStallName's local
--                   sync-write of the shared merqo.vendor_profile stall name)
--   tour_seen_at  — dashboard/tour-actions.ts (markTourSeen)
--   id            — never changed on purpose, but PostgREST compiles
--                   `.upsert({ id, name })` (login/actions.ts's
--                   completeSignup) into
--                   `INSERT ... ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id,
--                    name = EXCLUDED.name`, and Postgres checks UPDATE
--                   privilege on every column in that SET list at plan time —
--                   whether or not a conflict ever occurs. Omitting `id` would
--                   break signup with "permission denied for column id". The
--                   WITH CHECK added below pins the written id to auth.uid(),
--                   so granting it confers no ability to re-point the row.
REVOKE UPDATE ON stockkit.vendors FROM authenticated;
GRANT UPDATE (id, name, tour_seen_at) ON stockkit.vendors TO authenticated;

-- ── INSERT ───────────────────────────────────────────────────────────────────
-- completeSignup writes exactly (id, name); every other column has a default.
REVOKE INSERT ON stockkit.vendors FROM authenticated;
GRANT INSERT (id, name) ON stockkit.vendors TO authenticated;

-- ── vendors_self_update gains a WITH CHECK ───────────────────────────────────
-- USING alone governs which rows may be *targeted*, not what the updated row
-- may become — the same re-point escalation products_vendor_all already closes
-- with WITH CHECK (0001). Without it, the UPDATE (id) grant above would let a
-- vendor move their row onto another auth user's id. Row-level isolation is
-- otherwise unchanged.
DROP POLICY IF EXISTS "vendors_self_update" ON stockkit.vendors;
CREATE POLICY "vendors_self_update" ON stockkit.vendors
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
