# src/app/dashboard/(overview)

## Purpose

The dashboard's landing page (`/dashboard`) — a route group (no URL
segment) so `page.tsx` renders at the segment above it, keeping this
folder separate from `products/`/`profile/` without adding `/overview` to
the URL.

## Contents

- `page.tsx` — server component (`revalidate = 0`): fetches the vendor's
  active products, computes total inventory value (`on_hand *
unit_cost_cents`, summed, formatted via `formatPrice`), low-stock and
  out-of-stock counts, and an "urgent" list (out-of-stock first, then
  low-stock, capped at 5) linking into `products/`. Shows an empty-state
  card ("Add your first product") when the vendor has none yet. Both the
  populated and empty-state "Inventory value"/first-product cards carry
  `data-tour="inventory-value"` — step 1's anchor for the dashboard
  onboarding tour (`@/components/dashboard-tour`), since this is the
  first page a vendor lands on.

## Parent

[dashboard](../README.md)
