# migrations

## Purpose

The ordered, append-only SQL schema history for the `stockkit` Postgres
schema — every table, RLS policy, SECURITY DEFINER/INVOKER RPC, trigger, and
grant that defines stockkit's data model and its Postgres-enforced
authorization. Applied in filename order via the Supabase CLI; nothing here
is ever edited after landing — a later migration corrects an earlier one.

## Contents

12 files, `0000` through `0011`.

- **`0000_create_stockkit_schema.sql`** creates the `stockkit` schema and
  grants `USAGE` to `anon`/`authenticated`/`service_role`.
- **`0001_initial_schema.sql`** creates `vendors` (one row per auth user),
  `products` (a vendor's stocked items — name, unit, unit cost, on-hand
  quantity, low-stock threshold, active flag), and `stock_movements` (an
  append-only ledger of every quantity change: restock, waste, adjustment, or
  the initial opening balance). Adds the `updated_at` trigger on `products`,
  enables RLS on all three tables, and adds the baseline policies:
  vendor-owns-own-row for `vendors` (no public read — this data never needs
  to be public), `products_vendor_all` (`FOR ALL`, scoped both by `USING` and
  `WITH CHECK` so a product can't be re-pointed at a foreign `vendor_id`),
  and `stock_movements_vendor_select`/`_insert` — deliberately **no**
  update/delete policy, so default-deny keeps the ledger an immutable audit
  trail even for its own owner.
- **`0002_record_stock_movement.sql`** adds
  `stockkit.record_stock_movement` — the one write path for a stock change.
  Atomically applies a signed `delta` to a product's `on_hand`, rejects a
  move that would take it below zero, and appends the corresponding
  `stock_movements` row, all inside one function body (one implicit
  transaction, so a rejection rolls back the whole call). `SECURITY INVOKER`
  deliberately, not `DEFINER` — the caller is always the authenticated
  vendor acting on their own data, so RLS already does the authorization.
- **`0003_merqo_vendor_profile_sync.sql`** adds
  `stockkit.sync_vendor_profile` — a thin, `SECURITY DEFINER` wrapper that
  forwards a vendor's stall name to the shared `merqo.upsert_vendor_profile`
  RPC (defined in the sibling `merqo` project's
  `supabase/migrations/0009_vendor_profile.sql`), registering the vendor
  into the cross-kit `merqo.vendor_profile` table. Called best-effort from
  the signup flow; never blocks or fails a signup if the shared write fails.
- **`0004_feedback.sql`** adds `stockkit.feedback` (vendor NPS score +
  optional free-text message, submitted via `FeedbackForm`). RLS: a vendor
  may insert only their own row (`vendor_id = auth.uid()`); no select/update/
  delete policy for anyone.
- **`0005_vendor_feedback_backfill.sql`** backfills existing local feedback
  rows into the shared `merqo.vendor_feedback` table (merqo migration 0011),
  guarded to avoid failures when the shared schema is absent (e.g., in
  stockkit's standalone `supabase start` environment).
- **`0006_vendor_avatars_bucket.sql`** creates the public-read
  `vendor-avatars` Storage bucket (5MB limit, JPEG/PNG/WebP only) for the
  profile page's avatar upload, with RLS on `storage.objects` scoped to each
  vendor's own `{auth.uid()}/...` path for insert/update/delete.
- **`0007_rls_select_auth_uid.sql`** retrofits every `stockkit`-schema RLS
  policy (`vendors`/`products`/`stock_movements`/`feedback`) to wrap
  `auth.uid()` in a scalar subquery (`(select auth.uid())`), matching
  qkit's own retrofit (`0039_rls_select_auth_uid.sql`) — the bare form gets
  re-evaluated once per row instead of once per query. Row-level isolation
  is unchanged; the `storage.objects` avatar policies from `0006` are
  deliberately out of scope (same reasoning as qkit's).
- **`0008_vendor_tour_seen.sql`** adds `vendors.tour_seen_at TIMESTAMPTZ`,
  stamped by `markTourSeen` (`src/app/dashboard/tour-actions.ts`) when a
  vendor finishes or skips the dashboard onboarding tour, so it auto-runs
  only on first login. No RLS policy change — `vendors_self_update` already
  covers it.
- **`0009_vendor_plan.sql`** adds `vendors.plan TEXT` (values: 'free' or
  'pro'), defaulting to 'free' so every existing vendor stays on the Free
  tier until manually upgraded. No self-serve billing yet (see
  `docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md`). No RLS
  policy change — `vendors_self_update` already covers it. That last
  sentence was the bug `0010` fixes: covering the _row_ is not the same as
  covering the _column_.
- **`0010_vendor_plan_grants.sql`** (security) closes plan self-escalation.
  `0001` granted `authenticated` table-level INSERT/UPDATE on `vendors`, and
  the `vendors_self_*` policies only check row ownership, never which
  columns are written — so any signed-in vendor could
  `from('vendors').update({ plan: 'pro' })` from browser devtools and
  self-grant Pro. Replaces both table-level grants with **column-level**
  ones (`UPDATE (id, name, tour_seen_at)`, `INSERT (id, name)`), which is
  the only construct that actually restricts a column: Postgres cannot carve
  a column out of a table-level grant, so `REVOKE UPDATE (plan)` on top of
  one is a silent no-op (the same trap qkit fell into and fixed in its
  `0042_grant_and_enum_fixes.sql`). `plan` is now writable only by
  `service_role`, i.e. by an admin granting Pro manually. Also adds the
  missing `WITH CHECK` to `vendors_self_update` — `id` has to stay in the
  UPDATE column list because PostgREST compiles `completeSignup`'s
  `.upsert({ id, name })` into `ON CONFLICT (id) DO UPDATE SET id = ...`,
  and the `WITH CHECK` is what stops that grant being usable to re-point a
  row at another auth user.
- **`0011_product_limit_rls.sql`** (security) moves the Free plan's
  20-active-product cap into Postgres. It previously lived only in the
  `saveProduct` server action, which a direct browser-side
  `from('products').insert(...)` skips entirely. Splits the `FOR ALL`
  `products_vendor_all` policy into per-command
  `products_vendor_select`/`_update`/`_delete` (verbatim, `_update` keeps its
  `WITH CHECK`) plus a new `products_vendor_insert` gated on
  `stockkit.can_create_product(uuid)` — a `SECURITY DEFINER STABLE` function
  (definer rights avoid "infinite recursion detected in policy" when reading
  `products` from inside a `products` policy) that passes when the vendor is
  on Pro or is under their cap. Enforcement is deliberately **two-layered**,
  because an RLS `WITH CHECK` alone cannot hold an aggregate cap: it runs per
  row against the statement's own snapshot, so rows inserted earlier in the
  same statement are invisible to a later row's check and one 30-row
  `insert` passes 30 times over. The guarantee is therefore the
  `products_enforce_active_cap` trigger — an `AFTER INSERT`,
  `FOR EACH STATEMENT` trigger with a transition table
  (`REFERENCING NEW TABLE AS inserted_rows`) running
  `stockkit.enforce_product_limit()`, which recounts each affected vendor's
  real post-statement total once per statement and raises `42501` (the same
  SQLSTATE the RLS layer raises) if it is over. It takes a per-vendor
  `pg_advisory_xact_lock` before recounting, which also closes the
  concurrent-statement variant of the bypass; vendors are locked in sorted
  order so multi-vendor batches can't deadlock. The policy check is kept in
  front of it purely as a fast path for the ordinary single-row insert. Both
  the plan rule and the literal 20 live in one place,
  `stockkit.active_product_cap(uuid)`; the 20 mirrors
  `ENTITLEMENTS.free.maxActiveProducts` in `src/lib/plan.ts`, which stays the
  source of truth; SQL can't import it, so change the two together. Finally,
  it fixes the EXECUTE grants: functions default to `PUBLIC` and `stockkit`
  is PostgREST-exposed, so `can_create_product` was a live
  `POST /rest/v1/rpc/can_create_product` oracle for any vendor's plan and cap
  status. It is now revoked from `PUBLIC` and granted only to
  `authenticated` (which genuinely needs it — an RLS policy expression runs
  as the querying role); `active_product_cap` and `enforce_product_limit`
  are revoked and granted to no one, reachable only from inside the
  `SECURITY DEFINER` bodies and the trigger machinery respectively. Mirrors
  qkit's `0003_plans_and_booth_limit.sql`, which still has the multi-row hole
  this closes.
- **`0012_product_reactivation_limit.sql`** (security) closes the
  reactivation half of the cap bypass `0011`'s own comment flagged and
  deliberately left open: create 20 active, deactivate one, insert a
  replacement (back to 20 active + 1 inactive), then reactivate the
  deactivated one — 21 active, repeatable without limit. `saveProduct`'s
  update branch had **no app-level check at all** on this path, so this
  migration is the only enforcement, not a backstop. Same two-layer shape as
  `0011`, adapted for `UPDATE`: a `BEFORE UPDATE FOR EACH ROW` trigger
  (`stockkit.enforce_reactivation_limit_row`) rejects the ordinary
  one-row reactivation immediately by comparing `OLD.is_active`/
  `NEW.is_active` directly (something a plain RLS `WITH CHECK` can't do,
  since it only ever sees the proposed new row — it can't tell "this row
  was already active" apart from "this row is being reactivated", and the
  former must never be blocked just because the vendor is at cap on other
  rows); the guarantee is an `AFTER UPDATE FOR EACH STATEMENT` trigger
  (`stockkit.enforce_reactivation_limit_statement`) with both
  `REFERENCING OLD TABLE` and `NEW TABLE` transition tables, which joins
  them to find just the rows that actually flipped false→true and recounts
  each affected vendor's real post-statement total — needed because a
  batched `update ... where not is_active` hits the same per-statement
  snapshot blindness `0011` documented for batched `INSERT`. Deliberately a
  separate function/trigger pair from `0011`'s rather than a shared one:
  migrations are append-only here, and the two transition-table names can't
  share a `REFERENCING` clause across an `INSERT` trigger and an `UPDATE`
  trigger without coupling two independently-reasoned-about migrations
  together. `src/app/dashboard/products/actions.ts`'s `saveProduct` also
  gained a matching app-level check (fetch the existing row, and only
  cap-check when it was inactive) as the fast, friendly-error first line of
  defence — same relationship `0011`'s RLS layer has to its own trigger.

## Connectivity

Applied via the Supabase CLI (`supabase db push`/`db reset`) against the
local or hosted Postgres instance, or pasted directly into the Supabase SQL
Editor in order. `src/lib/types.ts` is a hand-maintained mirror of the
resulting schema and must be kept in sync by hand after any migration lands.
`0003` assumes `merqo.vendor_profile` and `merqo.upsert_vendor_profile`
already exist in the shared project (they're owned by the sibling `merqo`
repo, not this one) — applying stockkit's migrations to a fresh database
that lacks the `merqo` schema will fail on `0003` alone; `0000`-`0002` are
self-contained.

## Parent

[supabase](../README.md)
