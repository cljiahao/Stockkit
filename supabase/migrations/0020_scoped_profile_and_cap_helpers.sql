-- Legacy signup synchronization changes only the submitted name.
CREATE OR REPLACE FUNCTION stockkit.sync_vendor_profile(p_stall_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid := (select auth.uid());
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  PERFORM merqo.patch_vendor_profile(v_actor,p_stall_name,NULL::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION stockkit.sync_vendor_profile(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION stockkit.sync_vendor_profile(text) TO authenticated;

CREATE FUNCTION stockkit._can_create_product_unchecked(p_vendor uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT stockkit.active_product_cap(p_vendor) IS NULL OR
    (SELECT count(*) FROM stockkit.products WHERE vendor_id=p_vendor AND is_active)<stockkit.active_product_cap(p_vendor);
$$;
REVOKE ALL ON FUNCTION stockkit._can_create_product_unchecked(uuid) FROM PUBLIC,anon,authenticated,service_role;

-- RLS asks about the current vendor only; the public RPC must use the same scope.
CREATE OR REPLACE FUNCTION stockkit.can_create_product(p_vendor uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_vendor IS NULL THEN false
    WHEN p_vendor IS DISTINCT FROM (select auth.uid()) AND (select auth.role()) IS DISTINCT FROM 'service_role' THEN false
    ELSE stockkit._can_create_product_unchecked(p_vendor)
  END;
$$;
REVOKE ALL ON FUNCTION stockkit.can_create_product(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION stockkit.can_create_product(uuid) TO authenticated,service_role;

-- Trusted trigger execution uses the internal cap predicate, including operator SQL.
CREATE OR REPLACE FUNCTION stockkit.enforce_reactivation_limit_row()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT OLD.is_active AND NEW.is_active AND NOT stockkit._can_create_product_unchecked(NEW.vendor_id) THEN
    RAISE EXCEPTION 'active product limit exceeded: cannot reactivate, at the free plan cap' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION stockkit.enforce_reactivation_limit_row() FROM PUBLIC,anon,authenticated,service_role;

-- Membership checks disclose only the caller's own status; server administration may inspect any user.
CREATE OR REPLACE FUNCTION stockkit.is_admin(p_uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT p_uid IS NOT NULL AND
    (p_uid IS NOT DISTINCT FROM (select auth.uid()) OR (select auth.role()) IS NOT DISTINCT FROM 'service_role') AND
    EXISTS (SELECT 1 FROM stockkit.admins WHERE user_id=p_uid);
$$;
REVOKE ALL ON FUNCTION stockkit.is_admin(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION stockkit.is_admin(uuid) TO authenticated,service_role;
