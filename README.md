# stockkit

Inventory tracking for small vendors. Vendors sign in, add the products they
stock, log restocks/waste/adjustments against a running on-hand count, and
see stock value and low-stock alerts on a dashboard.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui (new-york) · Supabase (`@supabase/ssr` — auth, Postgres, RLS) ·
React Hook Form · Zod · Vitest · pnpm.

## Routes

| Route                 | Who           | Purpose                                                        |
| --------------------- | ------------- | -------------------------------------------------------------- |
| `/`                   | anyone        | landing page, links to `/login`                                |
| `/login`              | anyone        | Supabase email/password + Google OAuth sign-in / sign-up       |
| `/reset-password`     | anyone        | set a new password on a recovery session from `/auth/callback` |
| `/auth/callback`      | anyone        | exchanges an OAuth/recovery code for a session, then redirects |
| `/dashboard`          | vendor (auth) | inventory value + low/out-of-stock stats                       |
| `/dashboard/products` | vendor (auth) | product list; log stock, edit products, view movement history  |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values below
pnpm dev                     # http://localhost:3000
```

### Environment

Set these in `.env.local` (find them in Supabase → Project Settings → API).
`NEXT_PUBLIC_*` values are inlined at build time — **rebuild after changing them**.

| Var                                    | Notes                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | project URL                                                                                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (client-safe, respects RLS)                                                    |
| `SUPABASE_SECRET_KEY`                  | server-only; bypasses RLS (not used by any route yet — reserved for future admin/service work) |
| `NEXT_PUBLIC_BASE_URL`                 | e.g. `http://localhost:3000`                                                                   |

### Database

Apply the schema (creates the `stockkit` schema, `vendors`/`products`/
`stock_movements` tables, RLS policies, and the `record_stock_movement` /
`sync_vendor_profile` functions):

- **With the Supabase CLI:** `supabase db push`, then keep `src/lib/types.ts`
  in sync by hand (or `supabase gen types typescript --linked`).
- **Without the CLI:** paste each file in `supabase/migrations/`, in filename
  order, into Supabase → SQL Editor → Run. `src/lib/types.ts` is already
  hand-written to match.

`0003_merqo_vendor_profile_sync.sql` assumes the shared `merqo` schema (owned
by the sibling `merqo` repo) already exists in the target project — apply
`0000`-`0002` only against a database that doesn't have it.

## Scripts

```bash
pnpm dev        # dev server
pnpm build      # production build
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm check      # prettier --check + eslint + tsc --noEmit + route-logging check
pnpm format     # prettier --write
```

## Data model

- `vendors` — one row per auth user (`id` = `auth.users.id`), holds the stall name.
- `products` — belong to a vendor; `on_hand` is a live running balance, `unit_cost_cents` and
  `low_stock_threshold` drive the dashboard's value/alert stats.
- `stock_movements` — an append-only ledger (no update/delete RLS policy) of every quantity
  change: `restock`, `waste`, `adjustment`, or the `initial` opening balance recorded when a
  product is first created with a nonzero starting count.

Authorization is enforced in Postgres via RLS: a vendor only ever sees and mutates their own
`vendors`/`products`/`stock_movements` rows. The only write path for a stock change is
`stockkit.record_stock_movement` (atomic: applies the delta, rejects a move that would take
`on_hand` below zero, and appends the ledger row in one transaction). See `AGENTS.md` for full
conventions.

## Structure

### Contents

- `scripts/check-route-logging.mjs` — pre-existing scaffold check that every API route under `src/app/api` uses the `withLogging` wrapper; still guards `src/app/api/health/route.ts`.
- `src/app/(auth)/login/` — the combined sign-in/sign-up page (email/password + Google OAuth, plus a forgot-password flow) and its `completeSignup` server action (creates the `vendors` row, best-effort registers the vendor into the shared `merqo.vendor_profile` table).
- `src/app/(auth)/reset-password/` — completes a password reset on the recovery session `/auth/callback` establishes.
- `src/app/auth/callback/` — the `GET` Route Handler both Google OAuth and password-recovery links redirect through.
- `src/app/(public)/` — the public landing page (composed from `src/components/landing/`) + its layout.
- `src/app/api/health/` — the scaffold health-check route (logging-wrapped, used by the Dockerfile healthcheck); untouched.
- `src/app/dashboard/` — the authenticated vendor dashboard: `layout.tsx` (resolves the session + stall name + avatar URL, renders `dashboard-nav.tsx` — width-constrained to `max-w-site`, with inline Overview/Products links and the account dropdown), `(overview)/page.tsx` (stock-value/low/out-of-stock stats), and `products/` (the products workspace: list + detail, split across `page.tsx` (server fetch), `products-workspace.tsx` (client state/shell), `product-row.tsx`, `product-form.tsx`, `stock-log-form.tsx`, `movement-history.tsx`, `product-detail.tsx`, and `actions.ts` (the four server actions: `saveProduct`/`deleteProduct`/`recordStockMovement`/`getProductMovements`)).
- `src/components/ui/` — shadcn primitives (CLI-managed style, hand-copied from the sibling `qkit` project where a needed one — `checkbox`/`switch`/`alert-dialog` — wasn't already present here).
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
- `src/proxy.ts` — Next 16's middleware entrypoint; guards `/dashboard` behind a session check.
- `supabase/migrations/` — the ordered SQL schema history (own README).

### Connectivity

`src/` is the Next.js app itself; `supabase/migrations/` holds the Postgres schema and RLS
policies it depends on, applied via the Supabase CLI or the SQL Editor. `test/` holds the
pre-existing scaffold Vitest tests (API-route logging) — no tests were added for the new
auth/dashboard code in this pass (out of scope; see `AGENTS.md`).
