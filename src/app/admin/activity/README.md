# activity

## Purpose

Admin audit-trail viewer — the most recent `admin_audit` rows across every
vendor, rendered with `@merqo/ui`'s shared `AuditLogTable`.

## Contents

- `page.tsx` — `AdminActivityPage`: fetches `auditLog(100)` from
  `@/lib/admin-data` and renders it through `AuditLogTable`, with a
  `formatAction` map covering the action strings this repo actually writes
  today (`set_vendor_plan`, `set_pricing`, `delete_product`) and falling
  back to the raw action string for anything not yet in the map.

## Parent

[admin](../README.md)
