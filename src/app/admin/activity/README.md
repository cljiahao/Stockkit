# activity

## Purpose

Admin audit-trail viewer — the most recent `admin_audit` rows across every
vendor, rendered with `@merqo/ui`'s shared `AuditLogTable`.

## Contents

- `page.tsx` — `AdminActivityPage`: a Server Component that `requireAdmin()`-gates,
  fetches `auditLog(100)` from `@/lib/admin-data`, and passes the mapped
  `AuditLogEntry[]` to `AdminActivityLog`.
- `activity-log.tsx` — `AdminActivityLog` (`'use client'`): renders `entries`
  through `@merqo/ui`'s `AuditLogTable`, supplying the `formatAction`
  callback (a function prop can't cross the RSC boundary from `page.tsx`).
  Owns the `ACTION_LABEL` map covering the action strings this repo actually
  writes today (`set_vendor_plan`, `set_pricing`, `delete_product`) and
  falls back to the raw action string for anything not yet in the map.

## Parent

[admin](../README.md)
