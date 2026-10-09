-- Vendors edit product metadata directly, but quantities and ledger writes
-- must commit together through the constrained RPC. RLS still scopes metadata.
REVOKE UPDATE ON stockkit.products FROM authenticated;
GRANT UPDATE (name, unit, unit_cost_cents, low_stock_threshold, is_active)
  ON stockkit.products TO authenticated;
REVOKE INSERT ON stockkit.stock_movements FROM authenticated;

CREATE OR REPLACE FUNCTION stockkit.record_stock_movement(
  p_product_id uuid,
  p_delta numeric,
  p_reason text,
  p_note text DEFAULT NULL,
  p_unit_cost_cents integer DEFAULT NULL
) RETURNS stockkit.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_product stockkit.products;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_delta IS NULL OR p_delta = 0 OR p_delta::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_reason IS NULL OR p_reason NOT IN ('restock', 'waste', 'adjustment')
     OR (p_reason = 'restock' AND p_delta < 0)
     OR (p_reason = 'waste' AND p_delta > 0)
     OR length(p_note) > 500
     OR p_unit_cost_cents < 0 OR p_unit_cost_cents > 1000000 THEN
    RAISE EXCEPTION 'invalid stock movement' USING ERRCODE = '22023';
  END IF;

  -- Definer rights bypass RLS, so ownership is explicit and the row is locked
  -- until both quantity and ledger changes have committed or rolled back.
  SELECT * INTO v_product FROM stockkit.products
    WHERE id = p_product_id AND vendor_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned by caller' USING ERRCODE = '42501';
  END IF;
  IF v_product.on_hand + p_delta < 0 THEN
    RAISE EXCEPTION 'stock movement would take % below zero', v_product.name;
  END IF;

  UPDATE stockkit.products SET on_hand = on_hand + p_delta
    WHERE id = p_product_id AND vendor_id = v_actor RETURNING * INTO v_product;
  INSERT INTO stockkit.stock_movements (vendor_id, product_id, delta, reason, note, unit_cost_cents)
    VALUES (v_actor, p_product_id, p_delta, p_reason, p_note, p_unit_cost_cents);
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION stockkit.record_stock_movement(uuid, numeric, text, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION stockkit.record_stock_movement(uuid, numeric, text, text, integer)
  TO authenticated;

-- The AFTER INSERT trigger is the other constrained ledger entry point.
-- Product INSERT already passed its owner RLS and cap checks. Trigger functions
-- cannot be called as ordinary RPCs; PUBLIC execution remains revoked.
CREATE OR REPLACE FUNCTION stockkit.record_initial_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.on_hand::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'invalid opening balance' USING ERRCODE = '22023';
  END IF;
  IF NEW.on_hand > 0 THEN
    INSERT INTO stockkit.stock_movements (vendor_id, product_id, delta, reason)
      VALUES (NEW.vendor_id, NEW.id, NEW.on_hand, 'initial');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION stockkit.record_initial_stock_movement() FROM PUBLIC, anon, authenticated;
