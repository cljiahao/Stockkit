-- Products with history are archived; ancestor deletion must retain their ledger.
ALTER TABLE stockkit.stock_movements
  DROP CONSTRAINT stock_movements_product_id_fkey,
  ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES stockkit.products(id) ON DELETE RESTRICT,
  DROP CONSTRAINT stock_movements_vendor_id_fkey,
  ADD CONSTRAINT stock_movements_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES stockkit.vendors(id) ON DELETE RESTRICT;

-- A legacy duplicate aborts migration for review; it must not be silently erased.
CREATE UNIQUE INDEX stock_movements_one_initial_per_product
  ON stockkit.stock_movements (product_id) WHERE reason = 'initial';

-- The opening balance and its ledger entry commit or roll back together.
CREATE OR REPLACE FUNCTION stockkit.record_initial_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.on_hand > 0 THEN
    INSERT INTO stockkit.stock_movements (vendor_id, product_id, delta, reason)
    VALUES (NEW.vendor_id, NEW.id, NEW.on_hand, 'initial');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION stockkit.record_initial_stock_movement() FROM PUBLIC;
CREATE TRIGGER products_record_initial_stock_movement
  AFTER INSERT ON stockkit.products
  FOR EACH ROW EXECUTE FUNCTION stockkit.record_initial_stock_movement();
