-- 0013_stockkit_admin.sql
-- Platform-operator admin: an internal allow-list of admins and an audit
-- trail of the actions they take. Cross-vendor admin reads/writes run through
-- the service-role client (bypasses RLS), so the existing vendors/products/
-- stock_movements policies stay untouched; these two tables + is_admin() back
-- only the membership gate and the audit log. Mirrors loopkit's
-- 0003_loopkit_admin.sql, adapted to stockkit's schema and naming
-- conventions (double-quoted policy names, uppercase keywords, the
-- (select auth.uid()) planner-cache form this repo's own 0007 retrofit
-- established, applied directly here instead of needing a future retrofit).

CREATE TABLE stockkit.admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membership predicate (SECURITY DEFINER; pinned search_path). It reads the
-- table directly (RLS-exempt), so the admins_admin_select policy below can
-- call it without recursing on itself.
CREATE OR REPLACE FUNCTION stockkit.is_admin(p_uid UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM stockkit.admins WHERE user_id = p_uid);
$$;

CREATE TABLE stockkit.admin_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  target_id  UUID,
  detail     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX admin_audit_created_idx ON stockkit.admin_audit (created_at DESC);

-- RLS: only admins may read either table; writes are service-role only, so no
-- write policies exist (admin actions use the service-role client).
ALTER TABLE stockkit.admins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stockkit.admin_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_admin_select" ON stockkit.admins
  FOR SELECT USING (stockkit.is_admin((select auth.uid())));
CREATE POLICY "admin_audit_admin_select" ON stockkit.admin_audit
  FOR SELECT USING (stockkit.is_admin((select auth.uid())));

-- Data-API grants (be explicit).
GRANT SELECT ON stockkit.admins, stockkit.admin_audit TO authenticated;
GRANT ALL ON stockkit.admins, stockkit.admin_audit TO service_role;
GRANT EXECUTE ON FUNCTION stockkit.is_admin(UUID) TO anon, authenticated, service_role;

-- Bootstrap the first admin by SQL (there is no UI to self-elevate). Find your
-- id under Authentication → Users, then run:
--   INSERT INTO stockkit.admins (user_id) VALUES ('<YOUR_AUTH_USER_ID>');
