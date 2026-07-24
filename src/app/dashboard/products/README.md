# src/app/dashboard/products

The products workspace — list, add/edit, log stock movements, and view a
product's movement history.

## Contents

- `page.tsx` — server fetch of the vendor's products, renders
  `ProductsWorkspace`.
- `products-workspace.tsx` — client state/shell: holds the product list,
  selected product, and which panel (`ProductForm`/`StockLogForm`/
  `ProductDetail`) is open.
- `product-row.tsx` — one row in the list (name, unit, on-hand, stock
  status dot).
- `product-form.tsx` — create/edit form. Starting quantity is only
  editable when creating a new product; an existing product's `on_hand`
  only ever moves through `StockLogForm`. The unit-cost field is free
  text (`inputMode="decimal"`, no native numeric validation), so an
  unparseable value gets its own `aria-invalid`/inline error, same
  pattern as `profile-form.tsx`.
- `stock-log-form.tsx` — records a stock movement (restock/waste/
  adjustment) for one product. Same unit-cost inline-error treatment as
  `product-form.tsx`, on the restock-only cost field.
- `movement-history.tsx` — read-only ledger view for a product.
- `product-detail.tsx` — product detail panel (stats + movement history +
  entry points into the two forms above).
- `actions.ts` — the four server actions: `saveProduct`/`deleteProduct`/
  `recordStockMovement`/`getProductMovements`.

## Parent

[dashboard](../README.md)
