# stockkit — Plan Tier Page — Design

**Date:** 2026-07-30
**Status:** Approved (design); plan to follow.

## Summary

stockkit is the only live kit with no vendor-tier concept at all — no
`plan` column, no Free/Pro split, no Plan page, and `dashboard-nav.tsx`
carries an explicit "sanctioned skip" comment for it. This spec adds one,
following the exact shape qkit and paykit already ship (entitlements
module, gated action, plan page with an `UpgradeCta` that files a request
via the shared `merqo.submit_support_message` RPC — no payment processor,
no new table beyond one column).

Pricing itself (the $14/mo figure, the freemium-by-default/nudge-not-block
philosophy, and how this interacts with cross-kit bundle pricing) was
decided in `docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md`
— this spec only covers what Free vs. Pro gates _inside stockkit_ and how
the page/action code is built. Do not re-litigate the price here.

## Guiding decisions (locked during brainstorming)

- **Free tier is never blocked mid-operation.** Matches the family-wide
  rule (qkit's setup-time caps, paykit's 2026-07-22 freemium redesign):
  a Free vendor can keep recording stock movements against their existing
  products forever. The only things Free can't do are (a) add a _new_
  product past the cap, and (b) see more than the 10 most recent movements
  per product or export them — both are ceilings on adding/viewing, never
  a block on today's stock recording.
- **Product cap, not a movement/action cap.** Free = 20 active products.
  This mirrors qkit's setup-time cap pattern (1 booth, 6 menu items) —
  gate at creation, not at usage.
- **Movement history gate matches existing code, not an invented date
  window.** `getProductMovements` already hardcodes `.limit(10)` — that's
  the real, live Free-tier shape today, just not framed as a tier gate.
  Free keeps the existing 10-row cap unchanged; Pro removes the limit and
  adds CSV export. (An earlier round of this conversation proposed a
  30-day date window instead — dropped once the actual code showed a
  row-count cap already exists; matching real behavior beats inventing a
  new mechanism.)
- **Valuation trend reports are out of scope for this spec.** The
  cross-kit pricing doc lists it as a stockkit Pro perk, but there's no
  existing valuation/trend view in stockkit to gate — building one is a
  separate, larger feature. This spec ships the plan page advertising
  it as "coming soon" under Pro rather than blocking the whole plan-tier
  rollout on a feature that doesn't exist yet.

## What changes

### 1. Data model — `supabase/migrations/0009_vendor_plan.sql`

```sql
ALTER TABLE stockkit.vendors
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'
  CHECK (plan IN ('free', 'pro'));
```

No RLS change needed — `vendors_self_select`/`vendors_self_insert`
already scope to `id = auth.uid()`, and this is a plain column on an
already-covered table. `src/lib/types.ts`'s hand-maintained `Vendor` type
gets `plan: 'free' | 'pro'` added to match (this repo has no `supabase gen
types` step — types are hand-maintained per `AGENTS.md`).

### 2. Entitlements — new `src/lib/plan.ts`

Mirrors qkit's `src/lib/plan.ts` shape (`Tier`, `Entitlement`,
`ENTITLEMENTS` record, `normalizePlan`), sized down to stockkit's 2 tiers
and 2 real gates (no `pass` tier — stockkit has no itinerant-vendor
use case per the cross-kit pricing doc's decision to keep per-day pricing
qkit-only).

### 3. Product-cap gate — `src/app/dashboard/products/actions.ts`

`saveProduct`'s insert branch (not the update branch — editing an existing
product never adds to the count) counts the vendor's active products
before inserting a _new_ one and rejects over-cap with a friendly
`ActionResult` error, surfaced via the existing `toast.error(result.error)`
in `product-form.tsx` — no new UI wiring needed there.

### 4. Movement-history gate — `src/app/dashboard/products/actions.ts`

`getProductMovements` takes the vendor's plan into account: Free keeps
`.limit(10)` (unchanged), Pro removes the limit. A new `exportProductMovementsCsv`
action (Pro-only, rejects with a friendly error on Free) returns a CSV
string of the full ledger for one product; the UI triggers a client-side
download (no server-side file storage).

### 5. Plan page — new `src/app/dashboard/plan/page.tsx`

Server component: reads the signed-in vendor's `plan` directly off
`stockkit.vendors` (no separate config table needed, unlike paykit —
stockkit's plan lives right on the vendor row), shows a Free/Pro feature
comparison (product cap, movement history depth, CSV export, valuation
reports as "coming soon"), the $14/mo price, and an `UpgradeCta` on Free
that files a request via `submitSupportMessage(supabase, "billing", ...)`
— stockkit already has this helper (`src/lib/merqo-support.ts`), same
mechanism paykit's equivalent CTA uses. New `src/app/actions/plan.ts`
holds `requestProUpgradeAction`, a near-verbatim port of paykit's.

### 6. Nav — `src/app/dashboard/dashboard-nav.tsx`

Add a "Plan" `DropdownMenuItem` (Link to `/dashboard/plan`, matching the
existing Profile item's pattern) between Profile and Get help — the
locked order per `docs/business/2026-07-21-dashboard-nav-standard.md` is
Profile → kit settings → Plan → Get help → Feedback → Sign out; stockkit
has no kit-settings item, so Plan slots directly after Profile. Remove the
"No Plan item — stockkit has no vendor-tier concept (sanctioned skip...)"
line from the file's top comment — no longer true.

### 7. Cross-kit standards doc — `docs/business/2026-07-21-dashboard-nav-standard.md`

Update the stockkit row in the per-kit gap-checklist table: currently
reads "no Plan item, correctly (no vendor-tier concept)" — change to
reflect the new Plan item now existing. This is a locked cross-kit doc;
editing its gap-checklist table (not its locked rules) to reflect reality
is the same kind of update every other kit's row already reflects as it
shipped features.

## Testing

- `src/lib/plan.test.ts`: `normalizePlan` coercion, `ENTITLEMENTS` shape
  for both tiers.
- `src/app/dashboard/products/actions.test.ts` (new): `saveProduct` rejects
  a 21st product on Free with a friendly error (mocked count query),
  allows it on Pro; update branch never triggers the cap check regardless
  of count. `getProductMovements` respects the plan-based limit. New
  `exportProductMovementsCsv` test: Pro gets CSV content, Free gets a
  friendly rejection.
- `src/app/actions/plan.test.ts` (new): near-verbatim port of paykit's
  `plan.test.ts` — success path calls `submitSupportMessage` with category
  `"billing"`, unauthenticated path returns a friendly error without
  calling it.
- `src/app/dashboard/plan/page.dom.test.tsx` or a lighter render-only
  test if this repo's convention for server-component pages differs
  (check an existing `dashboard/profile/page` test file for the actual
  pattern used, don't assume DOM testing applies the same way to a server
  component here).
- `src/app/dashboard/dashboard-nav.dom.test.tsx` (existing file, extend):
  assert the Plan link renders and points to `/dashboard/plan`.

## Self-review

- No placeholders — every gate maps to a real, already-existing code path
  (`.limit(10)`, `saveProduct`'s insert branch) rather than an invented
  mechanism.
- Internally consistent: pricing figure ($14/mo) and philosophy (nudge not
  block) are pulled from the cross-kit doc by reference, not restated or
  contradicted here.
- Scope: explicitly excludes valuation-trend reports (no existing view to
  gate) and any Stripe/real-billing wiring (deferred per the cross-kit
  doc's Phase 3 gate) — upgrade stays a manual support-ticket request,
  identical in shape to paykit's live pattern today.
- Ambiguity check: "product cap" is scoped explicitly to the insert branch
  of `saveProduct`, not the update branch — an editing vendor already over
  a lowered cap (e.g. after a downgrade) can still edit existing products,
  just can't add new ones. Stated explicitly rather than left to infer.

## Parent

[stockkit/docs/superpowers](../README.md)
