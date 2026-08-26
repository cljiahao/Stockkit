# vendors

## Purpose

Admin vendors console — every vendor with their plan, product count, and a
per-row Free/Pro toggle.

## Contents

- `page.tsx` — `AdminVendorsPage`: fetches `listVendors()` and renders a vendor table via `@merqo/ui`'s shared `DataTable` (`ElevatedCard`-wrapped, "No vendors yet." empty state) with plan badges and `VendorPlanToggle`.
- `vendor-plan-toggle.tsx` — `VendorPlanToggle`: calls the `setVendorPlan` Server Action to flip a vendor's `plan` column between `'free'` and `'pro'` immediately, no confirm modal.

## Parent

[admin](../README.md)
