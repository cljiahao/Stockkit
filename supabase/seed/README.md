# seed

## Purpose

Demo seed data — sample products with automatic opening ledger entries, for
showcasing StockKit to vendors on a real (hosted) account. None of this
runs automatically via `supabase db reset`'s seed hook (`config.toml`
has automatic seeding disabled because no local `seed.sql` exists) — it's run manually and
is idempotent (`on conflict (id) do nothing`), so it's
safe to re-run.

## Contents

- `starter-inventory-prod.sql` — 6 products spanning all three stock
  statuses (3 ok, 2 low, 1 out — so the dashboard's value/alert stats and
  "Needs attention" list all have something real to show) and five automatic opening ledger entries for the nonzero balances (migration 0018 or later). Existing products and historical movements are left untouched. Takes a single `__VENDOR_ID__` placeholder (your
  own account's auth user id) and never touches `auth.users` or any other
  vendor's data.

## Connectivity

Run manually in the Supabase SQL Editor against your own hosted project,
after `supabase/migrations/` has been applied and you've already signed up
(`starter-inventory-prod.sql` assumes your `stockkit.vendors` row already
exists — it doesn't create one).

## Parent

[supabase](../README.md)
