-- A movement must belong to the same vendor as its referenced product.
-- Checking only vendor_id allows forged cross-vendor product references.
DROP POLICY IF EXISTS "stock_movements_vendor_insert" ON stockkit.stock_movements;
CREATE POLICY "stock_movements_vendor_insert" ON stockkit.stock_movements
  FOR INSERT WITH CHECK (
    vendor_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM stockkit.products p
      WHERE p.id = product_id AND p.vendor_id = (select auth.uid())
    )
  );
