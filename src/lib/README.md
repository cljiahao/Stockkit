# src/lib

Shared utilities and business logic. `schemas.ts` — Zod schemas for forms
and server actions, plus money-cents helpers: `formatPrice` (locale-
formatted currency string, `en-SG`/SGD, for read-only display) vs.
`centsToDollarString` (plain decimal, for form inputs/CSV) — the two
aren't interchangeable, the former includes a currency symbol and
thousands separators, the latter doesn't. `unit_cost_cents` fields are
capped at `MAX_MONEY_CENTS` ($10k), matching qkit's fat-finger guard rail;
`types.ts` — hand-maintained DB types mirroring
`supabase/migrations/` (now including `vendors.tour_seen_at` added by
`0008_vendor_tour_seen.sql` for the dashboard onboarding tour, `vendors.plan` added by
`0009_vendor_plan.sql` for Free/Pro tier tracking, and the `admins`/`admin_audit`
tables + `is_admin()` function added by `0013_stockkit_admin.sql` for the
Merqo-team admin console); `admin.ts` — `isAdmin(userId)`/`requireAdmin()`:
the admin-console gate, 404-ing a signed-out or non-admin request via
`notFound()` rather than revealing the route exists; `admin-data.ts` —
`platformTotals()`/`recentActivity(limit)`/`listVendors()`: cross-vendor
reads for the admin console via the service-role client (RLS-exempt on
purpose), aggregated in TS over flat `vendors`/`products`/`stock_movements`
reads; `plan.ts` — Free/Pro
entitlement model: `Tier` union type, `Entitlement` interface with
capabilities (`maxActiveProducts`, `movementHistoryLimit`, `csvExport`),
`ENTITLEMENTS` lookup table, `normalizePlan(value)` coercion function
for gating vendor features by plan, and `resolvePlanView(plan, entitlement)`
— the plan page's free-vs-pro branching (card label, `PlanFeature[]` list,
whether the upgrade CTA shows) lifted out of the page's JSX so it's
unit-testable without rendering a server component. Note
`ENTITLEMENTS.free.maxActiveProducts` is the source of truth for the
active-product cap, mirrored as a hardcoded literal in
`supabase/migrations/0011_product_limit_rls.sql`'s `active_product_cap`
(SQL can't import TypeScript) — change the two together; that one SQL
function is where both the plan rule and the literal live, so the RLS check
and the statement-level cap trigger that share it can't drift apart;
`stock.ts` — stock-status (ok/low/out)
classification (`stockStatusFor`, boundary-tested in `stock.test.ts`:
`onHand <= 0` is out, `onHand <= lowStockThreshold` is low, otherwise ok);
`action-result.ts` — `ActionResult<T>` server-action
return type; `merqo-vendor-feedback.ts` — `submitVendorFeedback`:
hand-written mirror of merqo's cross-schema `submit_vendor_feedback` RPC
contract, generic over the caller's own `Database`/schema; `merqo-support.ts`
— `submitSupportMessage`: hand-written mirror of merqo's cross-schema
`submit_support_message` RPC contract; `supabase/` — browser/server/service
clients, plus `middleware.ts`'s `updateSession`: session refresh/redirect
for both `/dashboard` and `/admin` (see `middleware.test.ts`) — everything
else (landing page, login) is public and skips the auth round-trip.

`brand-icon.tsx` — the `brandIcon(size)` generator consumed by
`src/app/icon.tsx`/`apple-icon.tsx`, per
`docs/business/2026-07-21-brand-icon-family-standard.md`'s shared
formula. `BRAND_STEEL`/`BRAND_PALE` are concrete-hex approximations of
`--primary`/`--primary-foreground` — keep in sync if those tokens change.
Its `fontFamily` fallback is the Georgia serif stand-in, matching
qkit, now that the app's display font is Fraunces (shared family face,
see `docs/business/2026-08-13-typography-family-standard.md`).

`image-resize.ts` — `resizeToWebp(file, maxDim, quality?)`, browser-only
(Canvas + `createImageBitmap`): resizes an uploaded image so its longest
side is `<= maxDim` and re-encodes it as WebP, falling back to the original
file untouched if the browser can't decode/encode it. Passed as `@merqo/ui`'s
`ImageUploader`'s `resizeImage` prop before every avatar upload.

`image-upload-adapter.ts` — `uploadVendorAvatar`, `@merqo/ui`'s
`ImageUploader.onUpload` adapter for the profile page's avatar uploader:
writes the resized blob to the `vendor-avatars` Storage bucket and
resolves the resulting public URL. Throws (never returns a result object)
on failure, per the package's contract.

`tour-prefs.ts` — `stampTourSeen(supabase, vendorId)`: updates
`vendors.tour_seen_at = now()`. A plain (non-`'use server'`) module so
`src/app/dashboard/layout.tsx` can call it directly during its own server
render — the durable half of the onboarding-tour "stamp on start" fix,
since the client-fired path (`src/app/dashboard/tour-actions.ts`'s
`markTourSeen`, which also delegates here) is fire-and-forget and can be
aborted by a hard navigation before it lands.

`vendor-name.ts` — `resolveVendorName(supabase, vendorId, localName)`: the
signed-in vendor's stall name, sourced from the shared
`merqo.vendor_profile.stall_name` via `merqo-vendor-profile.ts`'s
`getOrCreateVendorProfile` (same source of truth `profile/page.tsx` reads),
degrading to `localName` (stockkit's own `vendors.name`) on a merqo hiccup
rather than throwing, since it backs `dashboard/layout.tsx` — every
dashboard page. Used instead of a bare local `vendors.name` read so a
vendor whose stall name only lives in the shared table (set from another
Merqo kit, or via Google OAuth sign-in, which never creates a local
`vendors` row) doesn't see a stale/fallback name in the nav.
