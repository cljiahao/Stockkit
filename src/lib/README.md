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
`0008_vendor_tour_seen.sql` for the dashboard onboarding tour, and `vendors.plan` added by
`0009_vendor_plan.sql` for Free/Pro tier tracking); `stock.ts` — stock-status (ok/low/out)
classification; `action-result.ts` — `ActionResult<T>` server-action
return type; `merqo-vendor-feedback.ts` — `submitVendorFeedback`:
hand-written mirror of merqo's cross-schema `submit_vendor_feedback` RPC
contract, generic over the caller's own `Database`/schema; `merqo-support.ts`
— `submitSupportMessage`: hand-written mirror of merqo's cross-schema
`submit_support_message` RPC contract; `supabase/` — browser/server/service
clients.

`brand-icon.tsx` — the `brandIcon(size)` generator consumed by
`src/app/icon.tsx`/`apple-icon.tsx`, per
`docs/business/2026-07-21-brand-icon-family-standard.md`'s shared
formula. `BRAND_STEEL`/`BRAND_PALE` are concrete-hex approximations of
`--primary`/`--primary-foreground` — keep in sync if those tokens change.

`image-resize.ts` — `resizeToWebp(file, maxDim, quality?)`, browser-only
(Canvas + `createImageBitmap`): resizes an uploaded image so its longest
side is `<= maxDim` and re-encodes it as WebP, falling back to the original
file untouched if the browser can't decode/encode it. Used by
`src/components/image-uploader.tsx` before every avatar upload.

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
