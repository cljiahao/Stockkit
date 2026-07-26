-- supabase/migrations/0007_record_linked_movement.sql
--
-- Replaces record_stock_movement for any product with product_components
-- rows. Applies p_parent_delta to the parent exactly like
-- record_stock_movement; when p_parent_delta > 0 (the product was produced/
-- assembled), also fans out a proportional consumption to every declared
-- component, all in one transaction. A negative delta (waste, a sale
-- decrementing already-produced stock, a downward adjustment) never
-- re-touches components — they already left stock when the parent was
-- produced, so re-applying the ratio on the way down would double-count it.
--
-- p_component_overrides lets the caller supply the ACTUAL amount consumed
-- for one or more components (keyed by component_product_id as text),
-- overriding the stored quantity_per_unit estimate — real yield varies
-- (see the raw-material spec). Any component without an override falls back
-- to -1 * p_parent_delta * quantity_per_unit.
--
-- Below-zero checks are done as a SELECT ... FOR UPDATE pre-check followed
-- by the mutating UPDATE, not "UPDATE ... RETURNING INTO v_product" followed
-- by "IF v_product.on_hand < 0". The latter is dead code: products.on_hand
-- already has CHECK (on_hand >= 0) (0001), so an UPDATE that would drive it
-- negative fails immediately with a raw 23514 check-violation, before
-- control ever returns to this function body — the friendly "below zero"
-- RAISE EXCEPTION (and its P0001 code, which record_stock_movement's caller
-- pattern-matches on via error.message.includes('below zero')) would never
-- fire. FOR UPDATE holds the row lock from the check through the write, so
-- this pre-check-then-write is race-safe just like the single-statement
-- version it replaces.
CREATE OR REPLACE FUNCTION stockkit.record_linked_movement(
  p_parent_product_id uuid,
  p_parent_delta numeric,
  p_reason text,
  p_note text DEFAULT NULL,
  p_unit_cost_cents integer DEFAULT NULL,
  p_component_overrides jsonb DEFAULT NULL
) RETURNS stockkit.products
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = stockkit
AS $$
DECLARE
  v_product stockkit.products;
  v_parent_current stockkit.products;
  v_component_current stockkit.products;
  v_group_id uuid := gen_random_uuid();
  v_component RECORD;
  v_component_delta numeric;
BEGIN
  SELECT * INTO v_parent_current
  FROM stockkit.products
  WHERE id = p_parent_product_id AND vendor_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned by caller';
  END IF;

  IF v_parent_current.on_hand + p_parent_delta < 0 THEN
    RAISE EXCEPTION 'stock movement would take % below zero', v_parent_current.name;
  END IF;

  UPDATE stockkit.products
  SET on_hand = on_hand + p_parent_delta, updated_at = now()
  WHERE id = p_parent_product_id AND vendor_id = auth.uid()
  RETURNING * INTO v_product;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned by caller';
  END IF;

  INSERT INTO stockkit.stock_movements
    (vendor_id, product_id, delta, reason, note, unit_cost_cents, linked_movement_id)
  VALUES
    (v_product.vendor_id, p_parent_product_id, p_parent_delta, p_reason, p_note, p_unit_cost_cents, v_group_id);

  IF p_parent_delta > 0 THEN
    FOR v_component IN
      SELECT component_product_id, quantity_per_unit
      FROM stockkit.product_components
      WHERE parent_product_id = p_parent_product_id
    LOOP
      v_component_delta := COALESCE(
        (p_component_overrides ->> v_component.component_product_id::text)::numeric,
        -1 * p_parent_delta * v_component.quantity_per_unit
      );

      SELECT * INTO v_component_current
      FROM stockkit.products
      WHERE id = v_component.component_product_id AND vendor_id = auth.uid()
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'component product not found or not owned by caller';
      END IF;

      IF v_component_current.on_hand + v_component_delta < 0 THEN
        RAISE EXCEPTION 'stock movement would take % below zero', v_component_current.name;
      END IF;

      UPDATE stockkit.products
      SET on_hand = on_hand + v_component_delta, updated_at = now()
      WHERE id = v_component.component_product_id AND vendor_id = auth.uid()
      RETURNING * INTO v_product;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'component product not found or not owned by caller';
      END IF;

      INSERT INTO stockkit.stock_movements
        (vendor_id, product_id, delta, reason, note, unit_cost_cents, linked_movement_id)
      VALUES
        (v_product.vendor_id, v_component.component_product_id, v_component_delta, 'consumed', p_note, NULL, v_group_id);
    END LOOP;

    -- Re-fetch the parent: the loop above just overwrote v_product with the
    -- last component's row via its own RETURNING INTO. Without this, the
    -- function would return the last component's row (or the parent's row
    -- pre-fan-out if it happened to be reused unchanged) instead of the
    -- parent's actual final state — same variable, reused across every
    -- iteration, so whatever it held from the parent UPDATE above does not
    -- survive a non-empty loop.
    SELECT * INTO v_product FROM stockkit.products WHERE id = p_parent_product_id;
  END IF;

  RETURN v_product;
END;
$$;

-- SECURITY INVOKER deliberately, not DEFINER: the caller is always the
-- authenticated vendor themselves, so RLS on every SELECT/UPDATE/INSERT
-- above already does the authorization — no privilege escalation needed.
GRANT EXECUTE ON FUNCTION stockkit.record_linked_movement(uuid, numeric, text, text, integer, jsonb) TO authenticated;
