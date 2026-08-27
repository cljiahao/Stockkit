# metrics

## Purpose

`GET /api/merqo/metrics` — merqo hub's polling endpoint for stockkit's
cross-kit health/revenue dashboard. Bearer-secret gated (`bearerOk`,
`MERQO_METRICS_SECRET`) — merqo hub is the only caller.

## Contents

- `route.ts` — reads `vendors`, `products`, and `stock_movements`
  concurrently, calls `computeStockkitMetrics` (`src/lib/metrics.ts`), and
  returns the result shaped to merqo's `metricsPayloadSchema`. stockkit has
  no checkout/order concept — `src/lib/metrics.ts`'s own header comment
  documents the best-fit mapping onto its inventory domain: `revenue_cents_*`
  is money spent on `restock` movements, `gmv_cents_30d` is a live
  on-hand-inventory-value snapshot (not a real 30d flow), and
  `pending_upgrade_requests` is always `0` (no upgrade-request flow exists).
- `route.test.ts` — auth/success/upstream-failure cases for the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
