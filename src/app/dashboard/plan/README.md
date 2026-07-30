# dashboard/plan

## Purpose

The vendor-facing Free/Pro plan page — shows the vendor's current tier and
what it entitles them to, and (on Free) an interest CTA to request Pro.
stockkit has no self-serve billing yet; Pro is granted manually once a
request lands in the shared support inbox. Entitlement values (`ENTITLEMENTS`)
come from `@/lib/plan`, the same source `dashboard/products/actions.ts`'s
`vendorEntitlement` helper uses to gate product creation and movement
history/CSV export — this page only displays those limits, it doesn't
enforce anything itself.

## Contents

- `page.tsx` — `PlanPage()` (server, `revalidate = 0`): auth guard, reads
  the vendor's `vendors.plan` column, normalizes it via `normalizePlan`,
  and renders the current-plan summary plus the resolved `Entitlement`'s
  feature list (product cap, movement-history depth, CSV export). Renders
  `UpgradeCta` only when the vendor is on Free. The "back to Dashboard" nav
  uses the shared `@/components/back-button.tsx`'s `BackButton`.
- `upgrade-cta.tsx` — `UpgradeCta()`, client component. A single button that
  calls `requestProUpgradeAction` (`@/app/actions/plan`) in a transition and
  toasts success/error — no payment form, no pricing selection.

## Connectivity

Routed at `PAGE_ROUTES.PLAN` (`/dashboard/plan`, `@/lib/constants/routes`).
No nav link points here yet — this page ships in isolation; wiring
`dashboard-nav.tsx`'s account menu to it is a separate follow-up task.
`page.tsx` calls `createServerClient()` directly (not `vendorEntitlement` from
`products/actions.ts`, which is server-action-local) to read the vendor's
plan row and `ENTITLEMENTS`/`normalizePlan` from `@/lib/plan` to resolve it.
`upgrade-cta.tsx` calls `@/app/actions/plan`'s `requestProUpgradeAction`,
which files a `category: 'billing'` message through the same
`submitSupportMessage` (`@/lib/merqo-support`) helper the account-menu
"Get help" flow (`support.ts`) uses.

## Parent

[dashboard](../README.md)
