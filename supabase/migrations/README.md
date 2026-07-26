# migrations

## Purpose

The ordered, append-only SQL schema history for the `stockkit` Postgres
schema — every table, RLS policy, SECURITY DEFINER/INVOKER RPC, trigger, and
grant that defines stockkit's data model and its Postgres-enforced
authorization. Applied in filename order via the Supabase CLI; nothing here
is ever edited after landing — a later migration corrects an earlier one.

## Contents

8 files, `0000` through `0007`.

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
- **`0004_feedback.sql`** creates `stockkit.feedback` (vendor NPS + free-text
  message), RLS-enabled with an insert-only self policy — a vendor can
  submit feedback but never read, update, or delete it back.
- **`0005_vendor_feedback_backfill.sql`** one-time-copies existing
  `stockkit.feedback` rows into the shared `merqo.vendor_feedback` table
  (merqo migration `0011`), guarded to no-op when the `merqo` schema isn't
  present (e.g. a fresh stockkit-only CI database).
- **`0006_product_components.sql`** creates `stockkit.product_components` —
  a join table linking a parent product to the component product(s) it
  consumes per unit produced/assembled, serving both the raw-material and
  bundle/composite-product cases with one mechanism. RLS requires both the
  parent and the component to belong to the caller; a trigger rejects
  multi-level linking (a component can't itself have components, and vice
  versa). Also adds `stock_movements.linked_movement_id` (groups the rows
  one `record_linked_movement` call writes) and the `'consumed'`
  `stock_movements.reason` value.
- **`0007_record_linked_movement.sql`** adds
  `stockkit.record_linked_movement` — like `record_stock_movement`, but for
  a product with `product_components` rows: applies the caller's delta to
  the parent, and when that delta is positive (production/assembly) fans out
  a proportional (optionally overridden, for real-yield variance)
  consumption to each component, all atomically. A negative delta never
  re-touches components, since they already left stock when the parent was
  produced.

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
