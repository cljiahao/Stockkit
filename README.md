# stockkit

Inventory tracking for small vendors. Vendors sign in, add the products they
stock, log restocks/waste/adjustments against a running on-hand count, and
see stock value and low-stock alerts on a dashboard. The landing footer
matches qkit's exactly (single-row wordmark/tagline/copyright/sign-in
link, no bottom CTA band above it), and the page's `BackToTop` button and
"Get started" CTA size match the cross-kit landing-page parity pass.
Google OAuth sign-in forces the consent screen
to English (`hl=en`), matching the same fix in paykit/merqo. The Free
plan's 20-active-product cap is enforced in Postgres against both new
inserts and reactivating a deactivated product, not just in the app layer
(`supabase/migrations/0011_product_limit_rls.sql`,
`0012_product_reactivation_limit.sql`). Display font is Fraunces
(`src/app/layout.tsx`), the shared family face every Merqo kit now uses —
see `docs/business/2026-08-13-typography-family-standard.md` in the
workspace root for why. Dark theme is reachable via OS/browser preference
(`ThemeProvider`'s `defaultTheme="system"`) or a manual Light/Dark/System
override in the signed-in dashboard's `@merqo/ui` `AccountMenu` (v0.19.0+) —
no kit-local toggle on the public landing page anymore. Brand theme is
"Reefer Frost" (chilled cyan-teal
primary, frost-grey paper, crate-stamp crimson on destructive/attention
actions) as of 2026-08-19 — see `globals.css`'s own header comment;
`src/lib/brand-icon.tsx`'s ImageResponse-generated favicon/apple-touch-icon
carries the same rebrand. `admin_audit`'s coverage now extends past `/admin` (a vendor's own
product deletion is recorded too, via a shared `src/lib/audit.ts`) and
both `admin_audit` and `stock_movements` are append-only at the grant
level (`service_role` can no longer `UPDATE`/`DELETE` either, only
`SELECT`/`INSERT`) — see `AGENTS.md`'s data model section for the
retention policy.

See `CHANGELOG.md` for what's shipped, including the "Name | Tagline" Title
Case browser-tab title convention shared across every Merqo kit, and a fix
restoring card/background contrast in light mode after the Reefer Frost
rebrand had accidentally collapsed them to the same color, plus a later
brightness bump to the (already-correct) dark-mode card.

The dashboard onboarding tour's "seen" flag is now stamped synchronously
during `dashboard/layout.tsx`'s own server render (`src/lib/tour-prefs.ts`),
not just fire-and-forget from the client — the tour's own nav-link step
could trigger a hard navigation that aborted the client-fired write before
it landed, re-showing the tour every visit. The tour's Products step now
covers restock/waste/adjustment logging explicitly, its first step shows
an example product-row preview (its stock-status pill is the real
`StockStatusIndicator` component now, not a hand-copied color — the
hand copy had drifted into showing the wrong color — see
`../docs/superpowers/specs/2026-08-25-tour-example-badge-drift-fix-design.md`
(workspace root, cross-kit spec)), and its copy no longer uses em dashes.

The Supabase session-refresh middleware now covers `/admin` requests, not
just `/dashboard` (it previously skipped cookie-refresh for admin visits).
The dashboard is now built on the shared `@merqo/ui` component package
(v0.20.0, `package.json`; `useAsyncAction`, `Section`, `ImageUploader`, `DashboardTour`,
`TwoColumnSections`, `PricingForm`, and the composed `AccountMenu`+`DashboardNav`),
matching qkit's migration — see `CHANGELOG.md` for what moved. The account
menu's `DashboardNav` wrapper (`src/app/dashboard/dashboard-nav.tsx`) also
passes `@merqo/ui`'s `getSwitchKits('stockkit')` helper (its centralized
`KIT_FAMILY` registry, minus stockkit itself, resolved to each sibling
kit's real `<kit>.merqo.io` domain as of v0.14.1 — v0.14.0 had pointed at
each kit's `-sg.vercel.app` deployment host instead, a different domain
from the shared-session cookie's `.merqo.io` scope) into `@merqo/ui`'s
"Switch products" submenu, letting a signed-in vendor jump to another kit's
dashboard — SSO handles auth, this is pure in-product navigation. The Pro
price ($19.99/mo) lives in a live, admin-editable `stockkit.pricing`
table (`supabase/migrations/0014_stockkit_pricing.sql`, seeded, public-read
RLS, service-role-only writes) rather than a hardcoded constant — an admin
can change it from `/admin`'s Pricing section with no redeploy. A
mechanical comment-hygiene check (templateCentral 5.13.0's pattern list)
runs on every edit and in CI, flagging change-narration comments and
oversized comment blocks. `pnpm-workspace.yaml`'s `overrides` force-patches
transitive dependency CVEs, both from Next.js's own bundled deps
(`sharp`/`postcss`/`nanoid`) and dev-only tooling (`undici`/`fast-uri`/
`js-yaml`/`brace-expansion`, pulled in via vitest/eslint) — each entry
comments its advisory ID. `pnpm audit --prod --audit-level=high` hard-gates
CI; bump the relevant floor here when a new advisory lands rather than
waiting on the upstream package to update.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui (new-york) · Supabase (`@supabase/ssr` — auth, Postgres, RLS) ·
React Hook Form · Zod · Vitest · pnpm.

## Routes

| Route                 | Who           | Purpose                                                                                                  |
| --------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| `/`                   | anyone        | landing page, links to `/login`                                                                          |
| `/login`              | anyone        | Supabase email/password + Google OAuth sign-in / sign-up                                                 |
| `/reset-password`     | anyone        | set a new password on a recovery session from `/auth/callback`                                           |
| `/auth/callback`      | anyone        | exchanges an OAuth/recovery code for a session, then redirects                                           |
| `/dashboard`          | vendor (auth) | inventory value + low/out-of-stock stats                                                                 |
| `/dashboard/products` | vendor (auth) | product list; log stock, edit products, view movement history                                            |
| `/dashboard/plan`     | vendor (auth) | Free/Pro plan summary + request-upgrade CTA                                                              |
| `/admin`              | Merqo admin   | platform totals (vendors/products/plan mix), recent cross-vendor stock activity, live Pro pricing editor |
| `/admin/vendors`      | Merqo admin   | every vendor with a health-triage status, a Free/Pro plan toggle, sorted most-urgent first               |
| `/admin/activity`     | Merqo admin   | `admin_audit` viewer — the most recent admin/vendor actions worth reconstructing later                   |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev                     # http://localhost:3000
```

### Environment

Set these in `.env.local` (find them in Supabase → Project Settings → API).
`NEXT_PUBLIC_*` values are inlined at build time — **rebuild after changing them**.

| Var                                    | Notes                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | project URL                                                                                                                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (client-safe, respects RLS)                                                                                                |
| `SUPABASE_SECRET_KEY`                  | server-only; bypasses RLS — used by the `/admin` console's cross-vendor reads/writes (`src/lib/admin-data.ts`, `src/app/admin/actions.ts`) |
| `NEXT_PUBLIC_BASE_URL`                 | e.g. `http://localhost:3000`                                                                                                               |

### Database

Apply the schema (creates the `stockkit` schema, `vendors`/`products`/
`stock_movements` tables, RLS policies, the `record_stock_movement` /
`sync_vendor_profile` functions, the `admins`/`admin_audit` tables +
`is_admin()` function backing the `/admin` console, and the single-row
`pricing` table seeding the live Pro price):

- **With the Supabase CLI:** `supabase db push`, then keep `src/lib/types.ts`
  in sync by hand (or `supabase gen types typescript --linked`).
- **Without the CLI:** paste each file in `supabase/migrations/`, in filename
  order, into Supabase → SQL Editor → Run. `src/lib/types.ts` is already
  hand-written to match.

`0003_merqo_vendor_profile_sync.sql` assumes the shared `merqo` schema (owned
by the sibling `merqo` repo) already exists in the target project — apply
`0000`-`0002` only against a database that doesn't have it.

Running against local Supabase CLI (`supabase start`): `supabase/config.toml`
exposes the `stockkit` schema to the Data API and enables Google as an
external auth provider — set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/
`_SECRET` (see `.env.example`) in your root `.env` for "Continue with
Google" to work locally.

## Scripts

```bash
pnpm dev        # dev server (Turbopack)
pnpm build      # production build
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm check      # prettier --check + eslint + tsc --noEmit + route-logging check
pnpm format     # prettier --write
```

`prepare` (`husky`) runs automatically on `pnpm install` and wires up the
git hooks in `.husky/` (no native binary, so nothing for Windows Smart App
Control to block).

Tests: `*.dom.test.tsx` for full RTL+jsdom component-render tests,
`*.test.ts`/`*.test.tsx` for logic-only tests — see AGENTS.md. Every
`.dom.test.tsx` file shares `test/setup.ts`'s global RTL `cleanup()`,
jest-dom matchers, and Radix jsdom polyfills instead of repeating them
per file.

## Data model

- `vendors` — one row per auth user (`id` = `auth.users.id`), holds the stall name.
- `products` — belong to a vendor; `on_hand` is a live running balance, `unit_cost_cents`
  (capped at `MAX_MONEY_CENTS`, $10k) and `low_stock_threshold` drive the dashboard's value/alert
  stats.
- `stock_movements` — an append-only ledger (no update/delete RLS policy) of every quantity
  change: `restock`, `waste`, `adjustment`, or the `initial` opening balance recorded when a
  product is first created with a nonzero starting count.

Authorization is enforced in Postgres via RLS: a vendor only ever sees and mutates their own
`vendors`/`products`/`stock_movements` rows. Every policy wraps `auth.uid()` in a scalar subquery
(`(select auth.uid())`) so Postgres evaluates it once per query instead of once per row. The only
write path for a stock change is `stockkit.record_stock_movement` (atomic: applies the delta,
rejects a move that would take `on_hand` below zero, and appends the ledger row in one
transaction). See `AGENTS.md` for full conventions.

## Structure

### Contents

- `scripts/check-route-logging.mjs` — pre-existing scaffold check that every API route under `src/app/api` uses the `withLogging` wrapper; still guards `src/app/api/health/route.ts`.
- `src/app/error.tsx` + `src/app/not-found.tsx` + `src/app/global-error.tsx` — branded error/404/root-crash boundaries, matching qkit's and loopkit's family-wide pattern.
- `src/app/(auth)/login/` — the combined sign-in/sign-up page (email/password + Google OAuth, plus a forgot-password flow) and its `completeSignup` server action (creates the `vendors` row, best-effort registers the vendor into the shared `merqo.vendor_profile` table).
- `src/app/(auth)/reset-password/` — completes a password reset on the recovery session `/auth/callback` establishes.
- `src/app/auth/callback/` — the `GET` Route Handler both Google OAuth and password-recovery links redirect through; on a successful exchange also self-heals a local `vendors` row for the signed-in user (`ensureVendorRow`, upsert + `ignoreDuplicates`), since Google OAuth sign-in has no `completeSignup`-equivalent step to create one — without it, `markTourSeen`'s update silently no-ops and the onboarding tour re-runs on every dashboard visit.
- `src/app/(public)/` — the public landing page (composed from `src/components/landing/`) + its layout.
- `src/app/api/health/` — the scaffold health-check route (logging-wrapped, used by the Dockerfile healthcheck); untouched.
- `src/app/dashboard/` — the authenticated vendor dashboard: `layout.tsx` (resolves the session + stall name — via `@/lib/vendor-name`'s `resolveVendorName`, reading the shared `merqo.vendor_profile`, not the local `vendors.name` column — + avatar URL, renders `dashboard-nav.tsx` — a thin adapter over `@merqo/ui`'s composed `DashboardNav`+`AccountMenu`, its header now width-constrained by an inner `max-w-7xl` container (as of `@merqo/ui` v0.9.0 — was full-bleed/edge-to-edge and misaligned against the page content below it) — the shared component's own header layout, with inline Overview/Products links and the account dropdown — and `@/components/dashboard-tour`'s onboarding tour), `loading.tsx` (centered spinner shown while this segment or any nested page loads), `(overview)/page.tsx` (stock-value/low/out-of-stock stats), and `products/` (the products workspace — own README).
- `src/app/admin/` — the Merqo-team admin console (ported from loopkit's admin-console pattern): `requireAdmin()`-gated layout + nav, an overview page (vendor/product/plan totals + recent cross-vendor stock activity), `vendors/` (every vendor with a Free/Pro plan toggle), and `activity/` (an `admin_audit` viewer via `@merqo/ui`'s shared `AuditLogTable`) — own READMEs. Backed by `src/lib/admin.ts`/`admin-data.ts` and migration `0013_stockkit_admin.sql`.
- `src/components/dashboard-tour.tsx` + `tour-steps.ts` — thin adapter over `@merqo/ui`'s `DashboardTour`, which owns the `driver.js` overlay lifecycle (auto-runs once on first login, tracked server-side via `vendors.tour_seen_at`, stamped as soon as the tour starts rather than when it finishes, so a mid-tour refresh can't re-trigger it), replay button, and popover theming (generated at runtime from this app's own CSS custom properties — no local `tour.css`); stockkit supplies step content and routing.
- `src/app/actions/` — server actions shared across routes rather than colocated with a single page (vendor NPS feedback, Get-help support messages) — own README.
- `src/components/ui/` — shadcn primitives (CLI-managed style, hand-copied from the sibling `qkit` project where a needed one — `checkbox`/`switch`/`alert-dialog` — wasn't already present here) — own README.
- `.claude/` — the Claude Code harness (hook scripts, project skills, harness integrity manifest/verifier) — own README.
- `src/components/landing/` — the landing page's section components (`Hero`, `HowItWorks`, `Benefits`, `Faq`, `Cta`), plus `LedgerCardPreview` (`Hero`'s illustration — a static mock product card, not real data).
- `src/components/elevated-card.tsx` — stockkit's own lifted-shadow card treatment used on the public auth pages and the landing page's `HowItWorks`/`Benefits` cards (not qkit's perforated "Ticket").
- `src/hooks/use-async-action.ts` — the `pending`-flag-that-always-resets hook shared by every form/action in the app.
- `src/lib/supabase/` — the three Supabase client factories (`client.ts` browser, `server.ts` server + service-role, `middleware.ts` session refresh) plus `env.ts` (fail-fast public env validation).
- `src/lib/{types,schemas,action-result,stock}.ts` — the `Database` type mirror of the SQL schema, Zod validation schemas + money-cents helpers, the `ActionResult<T>` server-action return type, and the shared stock-status (`ok`/`low`/`out`) classification used by both the overview stats and the products workspace.
- `src/lib/brand-icon.tsx` + `src/app/icon.tsx` + `src/app/apple-icon.tsx` — the generated favicon/Apple-touch-icon (a `next/og` `ImageResponse`, no image assets), per `docs/business/2026-07-21-brand-icon-family-standard.md`'s shared cross-kit formula.
- `src/components/section.tsx` — thin adapter over `@merqo/ui`'s `Section` (icon chip + eyebrow + title + description), used by the profile page's five sections; injects stockkit's own `ElevatedCard` shell via `Section`'s `wrapper` render-prop.
- `@merqo/ui`'s `ImageUploader` + `src/lib/image-resize.ts` + `src/lib/image-upload-adapter.ts` — the profile page's avatar uploader (client-side resize to WebP, upload to the `vendor-avatars` Storage bucket via the local `uploadVendorAvatar` adapter).
- `src/components/social-icons.tsx` + `src/components/social-links-fields.tsx` — the shared social-link field list (real brand icons via `@icons-pack/react-simple-icons`) and the labeled-icon input group built from it.
- `src/components/layout/site-footer.tsx` — the mandatory footer (wordmark + tagline + `© <year> stockkit · a Merqo kit` credit line) per `docs/business/2026-07-21-landing-page-standard.md` §1.5, shared by the public and dashboard layouts.
- `src/components/layout/providers.tsx` — mounts `sonner`'s `Toaster`; no `QueryClientProvider` (matching qkit's/loopkit's `providers.tsx` — this app uses Server Components + Server Actions throughout, per AGENTS.md, so there's no client-side query cache to wire up).
- `src/proxy.ts` — Next 16's middleware entrypoint; guards `/dashboard` behind a session check.
- `supabase/` — `config.toml` (Supabase CLI local-dev config) and
  `migrations/` (the ordered SQL schema history) — own README.

### Connectivity

`src/` is the Next.js app itself; `supabase/migrations/` holds the Postgres schema and RLS
policies it depends on, applied via the Supabase CLI or the SQL Editor. `test/` holds the
pre-existing scaffold Vitest tests (API-route logging) — no tests were added for the new
auth/dashboard code in this pass (out of scope; see `AGENTS.md`).
