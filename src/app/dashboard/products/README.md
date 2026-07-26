# src/app/dashboard/products

The products workspace: list + detail, split across `page.tsx` (server
fetch of the vendor's products), `products-workspace.tsx` (client state/
shell — selection, mode, mobile dialog), `product-row.tsx`, `product-form.tsx`
(create/edit), `stock-log-form.tsx` (restock/waste/adjustment), `product-detail.tsx`
(tabs/stacked wrapper around form + stock log + history), `movement-history.tsx`,
and `actions.ts` (the server actions: `saveProduct`/`deleteProduct`/
`recordStockMovement`/`getProductMovements`, plus the linked-product actions
below).

`products-workspace.tsx` drives both breakpoints from one component: mobile
(`< md`) shows a single-column list where tapping a row opens a `Dialog`;
tablet/desktop (`md`+) shows a two-pane layout (list + a persistent detail
panel). The list column and the detail column are independent — the list
shows `EmptyProductsCard` when `products.length === 0`, while the detail
column renders purely off `mode`/`selected` (`'new'` → `ProductForm`,
`selected` → `ProductDetail`, neither → a placeholder prompt) — so "Add
product" works the same whether the vendor already has products or not.

## Linked product consumption (raw materials + bundles)

A product can declare that producing/assembling one unit of itself consumes
units of other products (`stockkit.product_components`, migration `0006`) —
one mechanism serving both the raw-material→finished-good case (stickers,
roasted coffee) and the bundle/composite-product case (a "pack of 5"). A
product with any component rows routes its stock-in movements through
`stockkit.record_linked_movement` (migration `0007`, via the
`recordLinkedMovement` action) instead of `record_stock_movement`: a
positive delta fans out a proportional consumption to each component
atomically, sharing one `linked_movement_id`; a negative delta (waste, a
downward adjustment) only ever touches the parent, since components already
left stock when the parent was produced.

`ProductForm`'s "Consists of" section (backed by `saveProductComponents`/
`getProductComponents`) lets a vendor declare a product's components.
`StockLogForm` shows a per-component "actually used" override on a restock
of a linked product, defaulting to `quantity_per_unit * quantity` but
editable for real-yield variance. `MovementHistory` marks ledger rows
sharing a `linked_movement_id` with a "· linked" suffix.

## Parent

[dashboard](../README.md)
