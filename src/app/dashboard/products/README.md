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
  pattern as `profile-form.tsx`. Its save/delete handlers wrap their
  server-action call in `try/catch` — a thrown rejection still shows a
  generic toast instead of failing silently. Tested in
  `product-form.dom.test.tsx`.
- `stock-log-form.tsx` — records a stock movement (restock/waste/
  adjustment) for one product. Same unit-cost inline-error treatment and
  `try/catch` handling as `product-form.tsx`. Tested in
  `stock-log-form.dom.test.tsx`.
- `movement-history.tsx` — read-only ledger view for a product.
- `product-detail.tsx` — product detail panel (stats + movement history +
  entry points into the two forms above).
- `actions.ts` — the six server actions: `saveProduct`/`deleteProduct`/
  `recordStockMovement`/`getProductMovements`/`exportProductMovementsCsv`.
  A shared `vendorEntitlement(supabase, vendorId)` helper resolves the
  vendor's plan via `@/lib/plan`'s `ENTITLEMENTS`/`normalizePlan` and is
  used by all three plan-gated actions:
  - `saveProduct`'s insert branch (new products only, never the edit/update
    branch): Free vendors are capped at `maxActiveProducts` active products
    and get a friendly rejection once at the cap; Pro is unlimited
    (`maxActiveProducts: null` skips the check entirely).
  - `getProductMovements`: capped at `movementHistoryLimit` rows (10) on
    Free; unlimited on Pro (`movementHistoryLimit: null` skips `.limit()`).
  - `exportProductMovementsCsv(productId)`: Pro-only (`entitlement.csvExport`),
    returns the product's full stock-movement ledger as CSV text
    (`date,reason,delta,note` header + one row per movement) or a friendly
    rejection on Free. Not yet wired to a download button in
    `product-detail.tsx` — action only, UI follow-up.

  Tested in `actions.test.ts`.

Both `.dom.test.tsx` files rely on `test/setup.ts`'s global RTL `cleanup()`
and no-op `ResizeObserver` stub (needed for the Radix `Switch`/`Select`
primitives each form uses) instead of declaring their own.

## Parent

[dashboard](../README.md)
