# docs/superpowers/specs

Design specs produced by the `superpowers:brainstorming` skill before
implementation — one file per feature, named `YYYY-MM-DD-<topic>-design.md`.

- `2026-07-22-landing-login-color-refresh-design.md` — landing/login
  structural parity with qkit/loopkit/paykit, plus the primary color refresh.
- `2026-07-22-landing-visual-refresh-design.md` — the follow-up visual pass
  (hero illustration, typography, navbar, motion) once structural parity
  alone turned out not to be enough.
- `2026-07-23-profile-page-standard-compliance-design.md` — bringing
  `/dashboard/profile` up to the locked profile-settings-page standard:
  display name, avatar upload, and password change, none of which existed
  before.
- `2026-07-30-plan-tier-page-design.md` — bringing stockkit up to the
  Free/Pro vendor-tier pattern qkit and paykit already ship: what Free vs.
  Pro gates, the entitlements-module shape, and why the movement-history
  gate matches the existing `.limit(10)` code rather than an invented date
  window.
