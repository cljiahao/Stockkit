# src/app/dashboard/products

The products workspace: list + detail, split across `page.tsx` (server
fetch of the vendor's products), `products-workspace.tsx` (client state/
shell — selection, mode, mobile dialog), `product-row.tsx`, `product-form.tsx`
(create/edit), `stock-log-form.tsx` (restock/waste/adjustment), `product-detail.tsx`
(tabs/stacked wrapper around form + stock log + history), `movement-history.tsx`,
and `actions.ts` (the four server actions: `saveProduct`/`deleteProduct`/
`recordStockMovement`/`getProductMovements`).

`products-workspace.tsx` drives both breakpoints from one component: mobile
(`< md`) shows a single-column list where tapping a row opens a `Dialog`;
tablet/desktop (`md`+) shows a two-pane layout (list + a persistent detail
panel). The list column and the detail column are independent — the list
shows `EmptyProductsCard` when `products.length === 0`, while the detail
column renders purely off `mode`/`selected` (`'new'` → `ProductForm`,
`selected` → `ProductDetail`, neither → a placeholder prompt) — so "Add
product" works the same whether the vendor already has products or not.

## Parent

[dashboard](../README.md)
