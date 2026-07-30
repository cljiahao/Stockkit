# migrations

## Purpose

The ordered, append-only SQL schema history for the `stockkit` Postgres
schema — every table, RLS policy, SECURITY DEFINER/INVOKER RPC, trigger, and
grant that defines stockkit's data model and its Postgres-enforced
authorization. Applied in filename order via the Supabase CLI; nothing here
is ever edited after landing — a later migration corrects an earlier one.

## Contents

9 files, `0000` through `0008`.

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
