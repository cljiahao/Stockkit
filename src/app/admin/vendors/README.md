# vendors

## Purpose

Admin vendors console — every vendor with their triage status, plan,
product count, and a per-row Free/Pro toggle, sorted most-urgent first.

## Contents

- `page.tsx` — `AdminVendorsPage`: fetches `listVendors()` (already sorted by triage urgency) and renders a vendor table via `@merqo/ui`'s shared `DataTable` (`ElevatedCard`-wrapped, "No vendors yet." empty state) with a status badge, plan badge, and `VendorPlanToggle`.
- `vendor-status-badge.tsx` — `VendorStatusBadge`: renders `src/lib/vendor-health.ts`'s `VendorStatus` via `@merqo/ui`'s shared `StatusBadge`, one stockkit brand token per status (`destructive`/`primary`/`muted`/`secondary`/`accent` for `attention`/`stuck`/`quiet`/`new`/`healthy`).
- `vendor-plan-toggle.tsx` — `VendorPlanToggle`: calls the `setVendorPlan` Server Action to flip a vendor's `plan` column between `'free'` and `'pro'` immediately, no confirm modal.

## Parent

[admin](../README.md)
