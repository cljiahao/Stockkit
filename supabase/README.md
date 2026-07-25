# supabase

## Purpose

Everything that defines and exercises the `stockkit` Postgres schema: the
ordered migration history (tables, RLS policies, the `record_stock_movement`/
`sync_vendor_profile` functions), local-dev configuration for the Supabase
CLI, and the pgTAP test suite that guards RLS isolation. This is the
authorization layer for the whole app — stockkit enforces access control in
Postgres (RLS), not in application code.

## Contents

- `config.toml` — Supabase CLI local-dev config: exposes the `stockkit` and
  `graphql_public` schemas to the Data API (`api.schemas`) — without this,
  `supabase start` falls back to exposing only `public`, and every query a
  Supabase client in `src/lib/supabase/` makes (they're all scoped to
  `{ db: { schema: 'stockkit' } }`) would be rejected as a schema-not-exposed
  error. Also enables the `google` external auth provider (reading
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`_SECRET` from `.env.example`) so
  `login-form.tsx`'s "Continue with Google" button works against local
  Supabase, pins `auto_expose_new_tables = false` (stockkit's migrations
  grant Data-API access explicitly instead), Postgres major version 17, and
  the standard local ports/services (API 54321, DB 54322, Studio 54323,
  Inbucket 54324).
- `migrations/` — the ordered SQL schema history (`0000`-`0006`); see its own
  README.
- `tests/` — the pgTAP RLS isolation test suite (`rls.test.sql`), run via
  `supabase test db`; carries its own inline fixtures, so it needs no seed
  data.

## Connectivity

`migrations/` is applied in order via the Supabase CLI (`supabase db push`)
to build the live schema that every Supabase client in `src/lib/supabase/`
queries against — see AGENTS.md for why no live/hosted Supabase project is
configured in this app's dev/CI environment, and why every `/dashboard` page
is `revalidate = 0` as a result. `tests/` is run standalone (`supabase test
db`) against a freshly-migrated database and is independent of the Next.js
app; it's the authoritative check that `migrations/`'s RLS policies actually
hold cross-vendor isolation, and is referenced directly from `AGENTS.md`'s
"RLS isolation" note.

## Parent

[stockkit](../README.md)
