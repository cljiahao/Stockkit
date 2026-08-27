# vendor-provision

## Purpose

`POST /api/merqo/vendor-provision` — merqo hub's push-provisioning hook,
called (bearer-secret, `provisionBearerOk`) whenever a vendor is granted
stockkit access. Creates the vendor's `stockkit.vendors` row if one doesn't
already exist, then reports their plan.

## Contents

- `route.ts` — validates `{ user_id }`, then:
  1. resolves the vendor's shared stall name via `getOrCreateVendorProfile`
     (`src/lib/merqo-vendor-profile.ts`) — done **before** the insert, since
     `stockkit.vendors.name` is `NOT NULL` with no default (unlike qkit's
     vendors table), so a bare `insert({id})` would violate the constraint;
  2. inserts `{ id: user_id, name: stallName }` into `vendors`, treating a
     unique-violation (`23505`) as `already_existed` rather than a failure,
     and a foreign-key violation (`23503`) as a 400 `Unknown user_id`;
  3. reads back `plan` and records a `merqo_vendor_provision` audit row via
     `recordAudit` (`src/lib/audit.ts`), under the `merqo_system` actor
     sentinel so it's distinguishable from a vendor-initiated action in the
     admin Activity tab.
- `route.test.ts` — auth/validation/insert-conflict/audit-logging cases for
  the route above.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
