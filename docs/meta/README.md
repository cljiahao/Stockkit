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
  This dated registry records the initial backlog; current audit findings live in `../audits/`.

- `2026-10-10-component-reuse-spec.md`: component consolidation boundaries, CSV export wiring and verification requirements.
