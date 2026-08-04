# admin

## Purpose

Merqo-team internal admin console — the gated layout, shared nav, and shared
figure-tile helper used by the overview and vendors screens. Ported from
loopkit's proven `src/app/admin/` pattern, adapted to stockkit's own
vendors/products/stock_movements domain (no "programs" concept here).

## Contents

- `actions.ts` — Server Actions (admin-only via `requireAdmin()`): `setVendorPlan`, writing via the service-role client and appending an `admin_audit` row.
- `admin-nav.tsx` — `AdminNav` client component: the Overview/Vendors tab bar, highlighting the active section by path.
- `layout.tsx` — `AdminLayout`: gates every `/admin` route with `requireAdmin()`, renders the header (`BrandText` wordmark, Admin badge, sign-out) and `AdminNav`.
- `page.tsx` — `AdminOverviewPage`: platform-wide totals (vendors by plan, products, active products, stock movements recorded) and a recent cross-vendor activity feed, wrapped in `ElevatedCard`.
- `stat.tsx` — `Stat`: a small labeled-value tile (`ElevatedCard`-based, `font-mono` value per this app's ledger typographic convention) used on the admin overview page.
- `vendors/` — vendor list with per-vendor Free/Pro plan toggles (own README).

## Connectivity

`vendors/` is the one admin section linked from `admin-nav.tsx`'s tab bar
besides the overview page itself; both render inside `layout.tsx`'s gated
shell. This folder's own `page.tsx` reads `platformTotals()` and
`recentActivity()` from `@/lib/admin-data`, rendering each total in a
`stat.tsx` `Stat` tile. `vendors/page.tsx` reads `listVendors()` from the same
module and renders its own table (no `Stat` tiles there), with
`vendor-plan-toggle.tsx` calling this folder's `actions.ts`'s `setVendorPlan`.

## Parent

[app](../README.md)
