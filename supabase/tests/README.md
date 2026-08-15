# tests

## Purpose

The pgTAP suite that proves stockkit's Postgres-enforced authorization
actually holds. Because authorization lives in RLS policies and grants
rather than in application code (see AGENTS.md), this suite — not the Vitest
suite — is the authoritative check on it: a mocked unit test can only assert
what the app _asks_ the database for, never what the database _permits_.

## Contents

- `rls.test.sql` — one rolled-back transaction with inline fixed-UUID
  fixtures (four auth users: vendor A, vendor B, vendor C — who deliberately
  has no `stockkit.vendors` row so the first-signup insert path is
  exercisable — and vendor D, added solely for the batched-reactivation
  test below). It asserts, per role:
  - **RLS is enabled** on `vendors`, `products`, `stock_movements`,
    `feedback`, `pricing` — a policy on a table with RLS off is decoration.
  - **Cross-vendor isolation** — A reads/updates only its own rows; B's rows
    are invisible, and an update targeting them matches 0 rows rather than
    raising (the `USING` clause filters the candidate set, it doesn't throw).
  - **The append-only ledger** — `stock_movements` has no UPDATE/DELETE
    policy _or_ grant, so even a row's own owner is refused (`42501`).
  - **Plan escalation is closed** (migration `0010`) — a vendor can update
    `name`/`tour_seen_at` but not `plan`, and cannot smuggle `plan: 'pro'`
    into their first `vendors` insert; the column-level grants reject the
    statement before RLS is even consulted.
  - **The Free active-product cap** (migration `0011`) — B is topped up to 20
    active products and refused a 21st, allowed again after deactivating one,
    and unrestricted once its `plan` is set to `'pro'`. That part only
    exercises the RLS `WITH CHECK`; the multi-row bypass it cannot catch is
    covered separately against C, who is on Free with zero products, so
    every row of a 25-row `insert ... select` passes the per-row check and
    only the statement-level `products_enforce_active_cap` trigger can
    reject it. Those assertions match the trigger's exact message, not just
    its `42501` — both layers raise the same SQLSTATE, so a message match is
    what proves the trigger, rather than the policy, did the work. They also
    assert the count afterwards, i.e. that the _whole_ statement rolled back
    rather than only its over-limit rows.
  - **The reactivation half of the cap bypass is closed** (migration `0012`)
    — C, sitting at exactly 20 active products, deactivates one, inserts a
    replacement (back to 20), then is refused reactivating the deactivated
    one (would be 21), caught by the `BEFORE UPDATE FOR EACH ROW` trigger.
    A batched reactivation (vendor D, fresh with 18 active + 3 inactive,
    reactivating all 3 in one statement) turns out to be caught by that same
    row-level trigger too — unlike RLS's `WITH CHECK` (evaluated per row
    against one fixed statement-wide snapshot, which is what makes it blind
    to a batched insert), a row-level trigger runs live SQL and Postgres
    advances the command counter between rows of the same statement, so the
    third row's trigger sees the first two already applied. The
    `AFTER UPDATE FOR EACH STATEMENT` trigger is still there as a backstop
    against the case the row-level trigger genuinely can't see: two separate
    sessions each reactivating one product concurrently.
  - **The cap functions aren't an RPC oracle** — `anon` executing
    `can_create_product` raises `42501`, so the `PUBLIC` EXECUTE default
    can't be used to probe an arbitrary vendor's plan over PostgREST.
  - **anon is locked out entirely** — no table-level grant at all, so reads
    raise `42501` rather than returning an empty set.
  - **`pricing` is public-read, admin-write-only** (migration `0014`) — both
    a signed-in vendor and `anon` can read the seeded row (`1999` cents), and
    neither has an UPDATE grant at all, so a direct write from either role
    raises `42501` before RLS is ever consulted; the only writer is the
    service-role `setPricing` admin action, which this suite can't exercise
    since service_role bypasses RLS by design.

  Keep `select plan(N)` in step with the number of assertions; pgTAP fails
  the run on a count mismatch.

## Connectivity

Run with `supabase test db` (Supabase CLI, Docker required), which applies
`../migrations/` to a fresh local database first — so a malformed migration
fails here too. CI runs it as the `db` job in `.github/workflows/ci.yml`.
The fixtures are inline and self-contained: `../seed/` is not involved, and
no API keys or running Next.js app are needed. `supabase/config.toml`
supplies the local ports and exposed schemas.

## Parent

[supabase](../README.md)
