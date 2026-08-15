# stockkit — Task Registry (2026-08-15)

stockkit's first standing backlog — no `docs/meta/` existed before this doc.
Unlike qkit/paykit's sweep-derived registries, this one is deliberately
short: stockkit has no open audit findings on file, no `TODO`/`FIXME`
comments in `src/`, and its own recent specs' "Non-goals"/"Out of scope"
sections name only already-shipped or genuinely cosmetic exclusions (see
`docs/superpowers/specs/2026-07-22-landing-visual-refresh-design.md` and
`2026-07-22-landing-login-color-refresh-design.md`). The items below are
the real, evidenced gaps found; this is not padded to look more thorough
than the codebase currently supports.

## P1 — makes stockkit actually used

### T1. Tie stock movement to qkit's sales — not started

stockkit is deliberately standalone today: manual stock in/out and costing
only, no qkit integration. Per `AGENTS.md`'s own "What stockkit is"
section:

> Tying stock movement to qkit's sales automatically (the "ties stock
> movement to your sales" tagline in `merqo/src/lib/kits.ts`) is a real
> planned cross-kit feature but is **not built** — deliberately out of
> scope for this pass. Don't assume any qkit integration exists.

This isn't a stale claim — verified live against
`merqo/src/lib/kits.ts:119` (2026-08-15): "Ties stock movement to your
sales" is still one of stockkit's four advertised feature bullets on the
Merqo landing page, even though the kit's tagline itself has since moved
to "Track stock in and out, and know what each dish really costs."
(`kits.ts:112`). The advertised feature and the shipped product have
diverged — a vendor reading the landing page today is told about a
capability that doesn't exist yet.

No design work exists for this (no spec under `docs/superpowers/specs/`
mentions a qkit integration approach). Scoping it — e.g. an
`order_completed`-style event from qkit driving `record_stock_movement`
calls, mirroring the loopkit auto-award integration order documented in
qkit's own `docs/DEPLOY.md` — is real, unstarted work, not a quick fix.

## P2 — real verification, not urgent yet

### T2. Test coverage gaps: mutation testing, RLS-adjacent coverage, older paths

`AGENTS.md`'s own Commands section states coverage "is not yet
comprehensive everywhere (mutation testing, `db` RLS-adjacent coverage,
and a few older paths are still ahead of it)." Confirmed against the
harness section of the same file: no `mutation` CI job exists (no Stryker
config — unlike qkit/paykit, which both run Stryker on `src/lib`,
advisory) and no `e2e` job exists (no Playwright suite) — both explicitly
"out of scope for this pass." CI's only coverage gate is changed-line
coverage via `diff-cover` (≥80%), which only checks lines touched by a
given PR, not the pre-existing gaps this note flags. No specific file is
called out here beyond what `AGENTS.md` already names generically —
closing this is a scoping exercise (decide what "RLS-adjacent" and
"older paths" mean concretely) before it's actionable work.

## P3 — cosmetic / low urgency

### T3. Plan upgrade is a manual support-ticket flow, no real billing

Per `docs/superpowers/specs/2026-07-30-plan-tier-page-design.md`'s
Self-Review: "any Stripe/real-billing wiring (deferred per the cross-kit
doc's Phase 3 gate) — upgrade stays a manual support-ticket request,
identical in shape to paykit's live pattern today." This is a cross-kit,
not stockkit-specific, deferral — paykit's own upgrade flow works the
same way — so it's not a stockkit-specific gap so much as a standing
cross-kit decision. Noted here for completeness; no action expected
unless the cross-kit Phase 3 gate itself moves.

## Parent

[docs/meta](README.md)
