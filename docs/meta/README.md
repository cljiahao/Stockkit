# meta

Cross-cutting project-management docs for stockkit — distinct from the
per-feature specs/plans in `docs/superpowers/` (that's granular, per-feature
design history; this is the standing backlog going forward).

## Contents

- `2026-08-15-stockkit-task-registry.md` — stockkit's first standing
  backlog. Three real, evidenced items: T1 (P1) the qkit stock-movement
  integration advertised on the Merqo landing page but not built, T2 (P2)
  the test-coverage gaps `AGENTS.md` already names (mutation testing, `db`
  RLS-adjacent coverage, older paths), and T3 (P3) the cross-kit-wide
  manual-support-ticket plan-upgrade flow (no real billing wiring yet).
  Deliberately short — no open audit findings, no `TODO`/`FIXME` comments
  in `src/`, and no unaddressed follow-up work flagged in recent specs.
