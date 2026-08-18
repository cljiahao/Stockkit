-- 0015_audit_immutability.sql
-- Defense-in-depth for the two append-only trails, `stockkit.admin_audit`
-- (0013) and `stockkit.stock_movements` (0001): RLS already blocks
-- authenticated/anon from ever updating or deleting a row in either table,
-- but RLS is a no-op against `service_role`, which carries BYPASSRLS — so
-- holding the service-role key was, until now, enough to quietly rewrite or
-- erase either trail. Table-level GRANT/REVOKE is checked independently of
-- RLS and does bind service_role, so revoking UPDATE/DELETE here closes that
-- gap without touching either table's RLS policies.
--
-- SELECT/INSERT stay granted on both: `recordAudit` (src/lib/audit.ts, used
-- by every action in src/app/admin/actions.ts and by `deleteProduct` in
-- src/app/dashboard/products/actions.ts) inserts new admin_audit rows via
-- the service-role client, and `stockkit.record_stock_movement` (0002)
-- inserts new stock_movements rows. Verified before writing this migration
-- that nothing in the application ever issues an UPDATE or DELETE against
-- stock_movements: the only grants it has ever held are `select, insert`
-- (0001), and the only write path, `record_stock_movement`, only INSERTs.
-- A product/vendor delete still cascades away that row's stock_movements
-- via the FK's ON DELETE CASCADE (0001) — that cascade runs under the
-- deleting session's own role (the vendor's `authenticated` role, via
-- `deleteProduct`), never as service_role, so it is unaffected by this
-- revoke.

REVOKE UPDATE, DELETE ON stockkit.admin_audit FROM service_role;
REVOKE UPDATE, DELETE ON stockkit.stock_movements FROM service_role;
