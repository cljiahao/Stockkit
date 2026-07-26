# seed

## Purpose

Demo seed data — sample products and a stock-movement ledger history, for
showcasing StockKit to vendors on a real (hosted) account. None of this
runs automatically via `supabase db reset`'s seed hook (`config.toml`
points at `./seed.sql`, which doesn't exist here) — it's run manually and
is explicitly idempotent (`on conflict ... do update/nothing`), so it's
safe to re-run.

## Contents

- `starter-inventory-prod.sql` — 6 products spanning all three stock
  statuses (3 ok, 2 low, 1 out — so the dashboard's value/alert stats and
  "Needs attention" list all have something real to show) plus an 11-row
  stock-movement ledger demonstrating every movement reason
  (`initial`/`restock`/`waste`/`adjustment`) with realistic notes and
  staggered timestamps. Takes a single `__VENDOR_ID__` placeholder (your
  own account's auth user id) and never touches `auth.users` or any other
  vendor's data.

## Connectivity

Run manually in the Supabase SQL Editor against your own hosted project,
after `supabase/migrations/` has been applied and you've already signed up
(`starter-inventory-prod.sql` assumes your `stockkit.vendors` row already
exists — it doesn't create one).

## Parent

[supabase](../README.md)
