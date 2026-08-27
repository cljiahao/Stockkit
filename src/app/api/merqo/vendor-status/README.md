# vendor-status

## Purpose

`GET /api/merqo/vendor-status?email=…` — merqo hub's lookup of whether a
vendor has a stockkit `vendors` row and, if so, their plan (`free`/`pro`).
Bearer-secret gated (`bearerOk`, `MERQO_METRICS_SECRET`) — merqo hub is the
only caller.

## Contents

- `route.ts` — resolves the email to an auth user via `listAllUsers`
  (paginated, `src/lib/list-all-users.ts`), reads `vendors` for that user's
  `plan`, and returns `{ active, plan }` via `resolveVendorStatus`
  (`src/lib/merqo-vendor-status.ts`).
- `route.test.ts` — auth/validation/upstream-failure cases for the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
