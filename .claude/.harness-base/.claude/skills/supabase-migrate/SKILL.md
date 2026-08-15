---
name: supabase-migrate
description: Apply Supabase schema migrations and regenerate DB types, with a safety gate.
allowed-tools: "Bash(supabase *), Bash(pnpm *)"
disable-model-invocation: true
---

stockkit uses Supabase (Postgres + RLS), not Drizzle. Migrations live in
`supabase/migrations/`.

## Apply schema

**Local (Dockerized dev) — the default for day-to-day work:**

- `supabase migration up` — apply pending migrations to the running local DB.
  (Or `supabase db reset` to rebuild local from `supabase/migrations/` + re-run
  the seed — destructive to local data only.)
- After any schema change, regenerate types from the local schema:
  `supabase gen types typescript --local > src/lib/types.ts`.

**Linked (hosted) project — only when intentionally changing the deployed DB:**

- `supabase db push` — applies pending migrations to the linked project.
- Regenerate types: `supabase gen types typescript --linked > src/lib/types.ts`.

**Without the CLI:**

- Paste the migration SQL into Supabase → SQL Editor → Run.
- Manually update `src/lib/types.ts` to match (this repo hand-maintains
  `types.ts` as a mirror of `supabase/migrations/` — no live project or
  codegen has been run against this schema yet).

## Safety gate (before running against a non-local project)

- Confirm the linked project ref is correct: `supabase projects list`.
- RLS must stay enabled on `vendors`, `products`, `stock_movements`,
  `feedback` — never disable it to make a query work; fix the policy or the
  query instead.
- `stock_movements` must never gain an UPDATE/DELETE policy for
  `authenticated` — it's an append-only ledger by design.
