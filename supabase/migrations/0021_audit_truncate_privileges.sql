-- TRUNCATE is a separate privilege and is not constrained by RLS.
-- Preserve SELECT/INSERT and normal owner-controlled maintenance.
REVOKE TRUNCATE ON stockkit.admin_audit, stockkit.stock_movements FROM service_role;
