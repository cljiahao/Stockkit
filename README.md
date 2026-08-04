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
`0012_product_reactivation_limit.sql`).

See `CHANGELOG.md` for what's shipped, including the "Name | Tagline" Title
Case browser-tab title convention shared across every Merqo kit.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui (new-york) · Supabase (`@supabase/ssr` — auth, Postgres, RLS) ·
React Hook Form · Zod · Vitest · pnpm.

## Routes

| Route                 | Who           | Purpose                                                                          |
| --------------------- | ------------- | -------------------------------------------------------------------------------- |
| `/`                   | anyone        | landing page, links to `/login`                                                  |
| `/login`              | anyone        | Supabase email/password + Google OAuth sign-in / sign-up                         |
| `/reset-password`     | anyone        | set a new password on a recovery session from `/auth/callback`                   |
| `/auth/callback`      | anyone        | exchanges an OAuth/recovery code for a session, then redirects                   |
| `/dashboard`          | vendor (auth) | inventory value + low/out-of-stock stats                                         |
| `/dashboard/products` | vendor (auth) | product list; log stock, edit products, view movement history                    |
| `/dashboard/plan`     | vendor (auth) | Free/Pro plan summary + request-upgrade CTA                                      |
| `/admin`              | Merqo admin   | platform totals (vendors/products/plan mix) + recent cross-vendor stock activity |
| `/admin/vendors`      | Merqo admin   | every vendor with a Free/Pro plan toggle                                         |

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
`sync_vendor_profile` functions, and the `admins`/`admin_audit` tables +
`is_admin()` function backing the `/admin` console):

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
- `src/app/auth/callback/` — the `GET` Route Handler both Google OAuth and password-recovery links redirect through.
- `src/app/(public)/` — the public landing page (composed from `src/components/landing/`) + its layout.
- `src/app/api/health/` — the scaffold health-check route (logging-wrapped, used by the Dockerfile healthcheck); untouched.
- `src/app/dashboard/` — the authenticated vendor dashboard: `layout.tsx` (resolves the session + stall name — via `@/lib/vendor-name`'s `resolveVendorName`, reading the shared `merqo.vendor_profile`, not the local `vendors.name` column — + avatar URL, renders `dashboard-nav.tsx` — width-constrained to `max-w-site`, with inline Overview/Products links and the account dropdown — and `@/components/dashboard-tour`'s onboarding tour), `loading.tsx` (centered spinner shown while this segment or any nested page loads), `(overview)/page.tsx` (stock-value/low/out-of-stock stats), and `products/` (the products workspace — own README).
- `src/app/admin/` — the Merqo-team admin console (ported from loopkit's admin-console pattern): `requireAdmin()`-gated layout + nav, an overview page (vendor/product/plan totals + recent cross-vendor stock activity), and `vendors/` (every vendor with a Free/Pro plan toggle) — own README. Backed by `src/lib/admin.ts`/`admin-data.ts` and migration `0013_stockkit_admin.sql`.
- `src/components/dashboard-tour.tsx` + `tour-steps.ts` + `tour.css` — the dashboard onboarding tour (ported from qkit): a `driver.js` overlay that auto-runs once on first login (tracked server-side via `vendors.tour_seen_at`, stamped as soon as the tour starts rather than when it finishes, so a mid-tour refresh can't re-trigger it) and replays via a floating "?" button.
- `src/app/actions/` — server actions shared across routes rather than colocated with a single page (vendor NPS feedback, Get-help support messages) — own README.
- `src/components/ui/` — shadcn primitives (CLI-managed style, hand-copied from the sibling `qkit` project where a needed one — `checkbox`/`switch`/`alert-dialog` — wasn't already present here) — own README.
- `.claude/` — the Claude Code harness (hook scripts, project skills, harness integrity manifest/verifier) — own README.
- `src/components/landing/` — the landing page's section components (`Hero`, `HowItWorks`, `Benefits`, `Faq`, `Cta`), plus `LedgerCardPreview` (`Hero`'s illustration — a static mock product card, not real data).
- `src/components/elevated-card.tsx` — stockkit's own lifted-shadow card treatment used on the public auth pages and the landing page's `HowItWorks`/`Benefits` cards (not qkit's perforated "Ticket").
- `src/hooks/use-async-action.ts` — the `pending`-flag-that-always-resets hook shared by every form/action in the app.
- `src/lib/supabase/` — the three Supabase client factories (`client.ts` browser, `server.ts` server + service-role, `middleware.ts` session refresh) plus `env.ts` (fail-fast public env validation).
- `src/lib/{types,schemas,action-result,stock}.ts` — the `Database` type mirror of the SQL schema, Zod validation schemas + money-cents helpers, the `ActionResult<T>` server-action return type, and the shared stock-status (`ok`/`low`/`out`) classification used by both the overview stats and the products workspace.
- `src/lib/brand-icon.tsx` + `src/app/icon.tsx` + `src/app/apple-icon.tsx` — the generated favicon/Apple-touch-icon (a `next/og` `ImageResponse`, no image assets), per `docs/business/2026-07-21-brand-icon-family-standard.md`'s shared cross-kit formula.
- `src/components/section.tsx` — the per-field-group shell (icon chip + eyebrow + title + description) used by the profile page's five sections.
- `src/components/image-uploader.tsx` + `src/lib/image-resize.ts` — the profile page's avatar uploader (client-side resize to WebP, upload to the `vendor-avatars` Storage bucket).
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
