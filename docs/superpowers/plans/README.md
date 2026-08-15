# docs/superpowers/plans

Task-by-task implementation plans produced by the `superpowers:writing-plans`
skill from an approved spec in `../specs/` — one file per feature, named
`YYYY-MM-DD-<topic>.md`.

- `2026-07-22-landing-login-color-refresh.md` — the structural-parity plan.
- `2026-07-22-landing-visual-refresh.md` — the visual-polish follow-up plan.
- `2026-07-23-profile-page-standard-compliance.md` — display name, avatar
  upload, and password change for `/dashboard/profile`, closing the gap
  against the locked profile-settings-page standard.
- `2026-07-30-plan-tier-page.md` — the Free/Pro vendor-tier feature: `plan`
  column, entitlements module, product-cap/movement-history/CSV gates, the
  `/dashboard/plan` page, nav item, and the security-hardening fix rounds
  (plan-escalation grant fix, database-level product-cap enforcement) that
  came out of its final review.
- `2026-08-15-stockkit-admin-pricing-and-feature-honesty.md` — the
  `stockkit.pricing` table, `setPricing` admin action, the `@merqo/ui`
  `PricingForm` wrapper wired into `/admin` (seeded at $19.99/mo),
  switching `/dashboard/plan` off the hardcoded price constant onto a live
  DB read, and deleting the false "coming soon" valuation-trend line from
  the Pro feature list.
