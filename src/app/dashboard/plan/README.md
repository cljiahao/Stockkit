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
  the vendor's `vendors.plan` column, normalizes it via `normalizePlan`, and
  hands the result to `@/lib/plan`'s `resolvePlanView` — which owns the
  free-vs-pro branching (card label, feature list, whether the upgrade CTA
  shows) so that logic is unit-testable without rendering a server
  component. The page itself is just the markup: it maps the returned
  `PlanFeature[]`, wrapping every `metric` feature's number in `font-mono`.
  The "back to Dashboard" nav uses the shared
  `@/components/back-button.tsx`'s `BackButton`.
- `upgrade-cta.tsx` — `UpgradeCta()`, client component. A single button that
  calls `requestProUpgradeAction` (`@/app/actions/plan`) in a transition and
  toasts success/error — no payment form, no pricing selection.
- `upgrade-cta.dom.test.tsx` — Testing-Library coverage for `UpgradeCta`:
  the button renders, a click files the request, and success/failure each
  raise the right toast (the action and `sonner` are both mocked).

## Connectivity

Routed at `PAGE_ROUTES.PLAN` (`/dashboard/plan`, `@/lib/constants/routes`)
and reachable from `dashboard-nav.tsx`'s account menu ("Plan").
`page.tsx` calls `createServerClient()` directly (not `vendorEntitlement` from
`products/actions.ts`, which is server-action-local) to read the vendor's
plan row and `ENTITLEMENTS`/`normalizePlan` from `@/lib/plan` to resolve it.
`upgrade-cta.tsx` calls `@/app/actions/plan`'s `requestProUpgradeAction`,
which files a `category: 'billing'` message through the same
`submitSupportMessage` (`@/lib/merqo-support`) helper the account-menu
"Get help" flow (`support.ts`) uses.

## Parent

[dashboard](../README.md)
