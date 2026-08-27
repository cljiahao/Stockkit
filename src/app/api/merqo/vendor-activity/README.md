# vendor-activity

## Purpose

`GET /api/merqo/vendor-activity?email=…` — the richer single-vendor view
behind merqo's `/admin/vendors/[email]` detail page, per
`docs/business/2026-08-26-cross-kit-vendor-activity-design.md`. Bearer-secret
gated (`bearerOk`, `MERQO_METRICS_SECRET` — the same secret `/metrics`
already uses, no new secret was minted).

## Contents

- `route.ts` — resolves the email to an auth user via `listAllUsers`, then
  reads that user's `vendors` row. 404s if the vendor was never found at all,
  or has no `stockkit.vendors` row — "never touched stockkit" is a clean
  404, never a 200 with empty fields. Otherwise reads that vendor's
  `products`/`stock_movements` and calls `computeVendorActivity`
  (`src/lib/merqo-vendor-activity.ts`), which reuses `vendor-health.ts`'s
  `buildVendorHealth` for the `status` field instead of duplicating its
  triage logic — the same map `/admin/vendors` builds. Returns
  `{ active, plan, status, metrics, lastActivityAt }`, `metrics` being a
  generic `{label, value}[]` (Products / Stock movements (30d) / Waste ratio
  (30d)) merqo renders without needing stockkit-specific domain knowledge.
- `route.test.ts` — auth/validation/404/upstream-failure/success cases for
  the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
