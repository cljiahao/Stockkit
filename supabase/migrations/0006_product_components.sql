-- supabase/migrations/0006_product_components.sql
--
-- Links a "parent" product (a finished good being produced, or a bundle
-- being assembled) to the component product(s) it consumes per unit
-- produced/assembled. One join table serves both the raw-material and
-- bundle cases — see stockkit.record_linked_movement (0007) for how the
-- fan-out actually applies this ratio.

CREATE TABLE stockkit.product_components (
  parent_product_id     UUID        NOT NULL REFERENCES stockkit.products(id) ON DELETE CASCADE,
  component_product_id  UUID        NOT NULL REFERENCES stockkit.products(id) ON DELETE RESTRICT,
  quantity_per_unit      NUMERIC     NOT NULL CHECK (quantity_per_unit > 0),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_product_id, component_product_id),
  CHECK (parent_product_id <> component_product_id)
);

-- ON DELETE RESTRICT on the component side: deleting a product that's still
-- someone's declared component is blocked, forcing the vendor to unlink
-- first — matches the app's existing bias toward explicit state changes.
-- ON DELETE CASCADE on the parent side: deleting a parent product cleans up
-- its own component links (nothing else references them).

grant select, insert, update, delete on stockkit.product_components to authenticated;
grant all on stockkit.product_components to service_role;

ALTER TABLE stockkit.product_components ENABLE ROW LEVEL SECURITY;

-- Both the parent AND the referenced component must belong to the caller —
-- a bare FK doesn't enforce that, only vendor_id columns with RLS do, and
-- product_components has neither column itself, so ownership is checked via
-- EXISTS against products (which IS scoped by vendor_id).
CREATE POLICY "product_components_vendor_all" ON stockkit.product_components
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = parent_product_id AND vendor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = parent_product_id AND vendor_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM stockkit.products
      WHERE id = component_product_id AND vendor_id = auth.uid()
    )
  );

-- No multi-level linking: a component can't itself have components, and a
-- parent can't itself be used as someone else's component. This is a
-- cross-row invariant RLS can't express, so it's a trigger, not a CHECK.
CREATE OR REPLACE FUNCTION stockkit.prevent_nested_components()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Early return for self-references: let the table's CHECK constraint
  -- reject the row with SQLSTATE 23514 instead of the trigger's P0001.
  -- This provides clearer user messaging ("can't link to itself") and
  -- ensures the pgTAP test sees the expected error code.
  IF NEW.parent_product_id = NEW.component_product_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM stockkit.product_components WHERE parent_product_id = NEW.component_product_id
  ) THEN
    RAISE EXCEPTION 'component_product_id cannot itself have components (no nested linking)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM stockkit.product_components WHERE component_product_id = NEW.parent_product_id
  ) THEN
    RAISE EXCEPTION 'parent_product_id cannot itself be used as a component elsewhere (no nested linking)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER product_components_no_nesting
  BEFORE INSERT OR UPDATE ON stockkit.product_components
  FOR EACH ROW EXECUTE FUNCTION stockkit.prevent_nested_components();

-- Grouping key so every stock_movements row written by one
-- record_linked_movement call (0007) can be displayed as one ledger event.
ALTER TABLE stockkit.stock_movements
  ADD COLUMN linked_movement_id UUID;

-- 'consumed' is written only by record_linked_movement (0007) for the
-- component side of a fan-out — never user-selectable, same status as
-- 'initial'. CHECK constraints on a column can't be altered in place, so
-- this drops and recreates it with the added value.
ALTER TABLE stockkit.stock_movements
  DROP CONSTRAINT stock_movements_reason_check;

ALTER TABLE stockkit.stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('restock', 'waste', 'adjustment', 'initial', 'consumed'));
