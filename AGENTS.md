# AGENTS.md — stockkit

> STOP — This project diverges from the stock templateCentral Next.js stack on
> the data layer only. Auth/DB are **Supabase** (`@supabase/ssr`), not
> better-auth + Drizzle. Authorization is enforced in Postgres via **RLS**, not
> an app repository layer. Runtime matches tc: Next 16, route protection in
> `src/proxy.ts`, and `cookies()`/`headers()`/`params`/`searchParams` are async.

## What stockkit is

Inventory tracking for small vendors — v1 / first cut. A vendor signs in, adds
the products they stock, and logs stock in/out (restock, waste, adjustment)
against a running on-hand count and per-unit cost. The dashboard surfaces
total inventory value and low/out-of-stock alerts.

This is standalone: manual stock in/out and costing only. Tying stock
movement to qkit's sales automatically (the "ties stock movement to your
sales" tagline in `merqo/src/lib/kits.ts`) is a real planned cross-kit
feature but is **not built** — deliberately out of scope for this pass. Don't
assume any qkit integration exists.

## Stack

Next.js 16 · App Router · Turbopack · TypeScript strict · Tailwind v4 ·
shadcn/ui (new-york) · React Hook Form · Zod · Supabase (`@supabase/ssr`) ·
Vitest · pnpm · Node ≥24

`@tanstack/react-query` is a dependency (inherited from the base scaffold) but
**not wired in** — this app uses plain Server Components + Server Actions
(the qkit pattern), not client-side query caching. Don't add TanStack Query
usage without discussing it first; it'd be a second data-fetching pattern
living alongside the real one.

## Commands

```bash
pnpm dev          # dev server — http://localhost:3000
pnpm build        # production build
pnpm test         # run test suite (vitest)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm check        # prettier --check + eslint + tsc --noEmit + route-logging check
pnpm format       # prettier --write
```

No e2e suite. Component behavior (anything rendered with Testing Library +
jsdom) is covered by `*.dom.test.tsx` files; plain logic/schema/lib tests
use `*.test.ts`/`*.test.tsx` — same convention as qkit/loopkit. Auth,
dashboard, and products all have real coverage now; it's not yet
comprehensive everywhere (mutation testing, `db` RLS-adjacent coverage,
and a few older paths are still ahead of it).

## File Layout

```
src/app/(auth)/login/            — combined sign-in/sign-up page + completeSignup action
src/app/(public)/                — landing page
src/app/dashboard/               — vendor dashboard: layout (session + sign-out), overview stats
src/app/dashboard/products/      — products workspace: list/detail UI + server actions
src/proxy.ts                     — Supabase session refresh + /dashboard guard (Next 16)
src/lib/supabase/                — browser / server / service clients + middleware helper
src/lib/types.ts                 — DB types (hand-maintained mirror of supabase/migrations)
src/lib/schemas.ts                — Zod schemas for forms + actions, money-cents helpers
src/lib/stock.ts                  — shared stock-status (ok/low/out) classification
src/lib/action-result.ts          — ActionResult<T> server-action return type
src/components/ui/                — shadcn primitives (CLI-managed style; do not hand-edit)
supabase/migrations/              — SQL schema + RLS + record_stock_movement/sync_vendor_profile
```

## Data model

- `vendors` (id = `auth.users.id`, stall name).
- `products` — belong to a vendor; `on_hand` (numeric, live balance),
  `unit_cost_cents`, `low_stock_threshold`, `is_active`.
- `stock_movements` — append-only ledger (`restock` / `waste` / `adjustment` /
  `initial`). No update/delete RLS policy — default-deny keeps it immutable,
  even for the row's own owner.
- The only write path for a stock change is `stockkit.record_stock_movement`
  (SECURITY INVOKER — the caller is always the vendor acting on their own
  data, so RLS already authorizes it): applies the delta to `on_hand`,
  rejects a move that would take it below zero, and appends the ledger row,
  atomically (one function body = one implicit transaction).
- RLS: a vendor sees/edits only their own `vendors` row, `products`, and
  `stock_movements`. No public read of anything — unlike qkit's booths, none
  of this data ever needs to be public.
- `stockkit.sync_vendor_profile` (SECURITY DEFINER) forwards a vendor's stall
  name to the shared `merqo.upsert_vendor_profile` RPC on signup — best-effort,
  never blocks or fails signup if it errors.

## Rules (always)

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod at every boundary (forms + server actions).
- Authorization lives in **RLS policies**, not in app code. Never widen a
  policy to "fix" a query — fix the query or the session instead.
- Use the **service-role client** (`createServiceClient`) only in Server
  Actions / Route Handlers, never in client components, and only when a task
  genuinely needs to bypass RLS — none of the current vendor-owned writes do;
  they all go through the RLS-scoped `createServerClient()`.
- No secrets in `NEXT_PUBLIC_*`. `NEXT_PUBLIC_SUPABASE_*` are inlined at
  build time — rebuild after changing them.
- `@supabase/ssr` and `@supabase/supabase-js` versions must stay compatible
  (check `package.json`, not this number, since both get bumped) or every
  query degrades to `never`.
- After editing the schema, update both `supabase/migrations/` and
  `src/lib/types.ts` (or regenerate via `supabase gen types typescript`).
- Comment hygiene: own-line comments only (no trailing inline comments),
  enforced by `no-inline-comments: error`; no committed dead/commented-out
  code, enforced by `sonarjs/no-commented-code: error`.
- `font-mono` on every quantity/cost figure shown to the vendor — the app's
  one deliberate typographic signature (a "ledger" motif). Don't drop it on
  new numeric displays.

## AI Harness

PreToolUse: blocks secret files (exit 2): `.env*` (except `.env.example`),
cert files (`.pem`/`.key`/`.p12`/`.pfx`/`.secret`), `credentials.json`/`.netrc`/`.secrets`;
and blocks `--no-verify`. App code, skills, specs, and `.github/workflows/`
unrestricted.
UserPromptSubmit: pattern-checks prompts for injection phrases; exit 2 blocks.
PostToolUse: `tsc --noEmit --incremental` after every Edit/Write. Feedback-only.
Stop: exits 0 when `stop_hook_active` (no re-entry loop); else runs the test
suite, exit 2 feeds failures back, exit 0 on pass.
SessionStart (startup|resume|compact): re-injects first 30 lines of this file.
`permissions`: max-privilege — bare-tool `allow` (Bash/Read/Edit/Write/web/Skill/
Task) so common work doesn't prompt; `deny` covers secret reads/edits and
irreversible ops (`rm -rf`, `git push --force`/`-f`, `git reset --hard`,
`git clean -fd/-fx`, `git filter-branch`, ref-delete). `ask` gates `Edit(...)`
on the medium-security governance files: `AGENTS.md`, `CLAUDE.md`,
`.claude/harness.json`, `.claude/settings.json`, `.claude/settings.local.json`.
Deny always wins; it's a guardrail, not a sandbox.
Git hooks (husky): pre-commit runs format/lint/typecheck + gitleaks
secret-scan on staged files, plus a readme-coupling staleness warning;
commit-msg enforces Conventional Commits; pre-push runs the harness
integrity check + quality gate. Migrated 2026-08-01 off lefthook, whose
unsigned `lefthook.exe` Windows Smart App Control blocks unconditionally —
see `docs/superpowers/specs/2026-08-01-lefthook-to-husky-migration-design.md`.
CI (GitHub Actions): hard gate on changed-line coverage (`diff-cover`
≥80%), lockfile-in-sync (`--frozen-lockfile`), a changelog-touched check, a
readme-freshness check, harness integrity, a `db` job (pgTAP RLS suite), and
(via `security.yml`) a full-history gitleaks scan + `pnpm audit` + a
dormant self-skipping CodeQL job. No `mutation` job (no Stryker config) and
no `e2e` job (no Playwright suite) — both out of scope for this pass.
RLS isolation: `supabase/tests/rls.test.sql` via `supabase test db`.
Project skills (directory form, `<name>/SKILL.md`): `.claude/skills/` |
Manifest: `.claude/harness.json`

## Project-Specific Notes

- No live Supabase project is configured in the dev/CI environment this app
  was built in — `.env.local` has empty Supabase values on purpose, so
  `src/lib/supabase/env.ts`'s fail-fast check throws a clear error instead of
  the app silently misbehaving. Every page under `/dashboard` sets
  `export const revalidate = 0` so Next never tries to statically prerender a
  page that needs a real session/DB round-trip.
- The design accent is steel/cobalt blue (`oklch(0.45 0.09 250)`-ish),
  deliberately distinct from qkit's warm ember and loopkit's gold. Green/
  amber/red (`--stock-ok`/`--stock-low`/`--stock-out`) are reserved for
  stock-level status only — never reused as the brand accent.
