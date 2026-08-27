# src/app/api/merqo

The bearer-secret HTTP surface merqo's hub calls into — the other half of
every sibling kit's (qkit/loopkit/paykit) own cutover. Closes the gap that
had stockkit listed "live" on merqo's landing page with zero real
integration: before this, `merqo.products.status` for stockkit was stuck at
`coming_soon` because there was nothing here for merqo to poll or provision
against.

Every route validates its bearer token via `src/lib/merqo-auth.ts`
(`bearerOk` reads `MERQO_METRICS_SECRET`, `provisionBearerOk` reads the
separate `MERQO_PROVISION_SECRET` — a leak of the routine metrics-polling
secret must not also grant provisioning access) and is wrapped in
`src/lib/utils/with-logging.ts`'s `withLogging`, same as every other route
handler in this app.

## Contents

- `metrics/` — `GET /api/merqo/metrics`: the platform-aggregate poll for
  merqo's cross-kit revenue/health dashboard.
- `vendor-status/` — `GET /api/merqo/vendor-status?email=`: a single
  vendor's `{active, plan}`.
- `vendor-provision/` — `POST /api/merqo/vendor-provision`: merqo's
  push-provisioning hook, creating a `stockkit.vendors` row for a newly
  granted vendor.
- `vendor-activity/` — `GET /api/merqo/vendor-activity?email=`: a richer
  single-vendor view (plan, triage status, labeled metrics, last activity)
  for merqo's per-vendor admin detail page — see
  `docs/business/2026-08-26-cross-kit-vendor-activity-design.md` in the
  workspace root.

## Parent

See the repo root [README.md](../../../../README.md) for the full layout.
