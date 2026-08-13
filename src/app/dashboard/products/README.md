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
  only ever moves through `StockLogForm`. The unit field is a shadcn
  `Command`+`Popover` combobox (free text plus `UNIT_PRESETS`
  suggestions), replacing a raw `<input list>`/`<datalist>` for
  consistent cross-browser rendering. The unit-cost field is free
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
  used by all three plan-gated actions. It fails **closed** — a plan lookup
  that errors degrades to Free rather than Pro — but logs the error, so a
  DB outage silently downgrading a paying vendor leaves a trace:
  - `saveProduct`'s insert branch: Free vendors are capped at
    `maxActiveProducts` active products and get a friendly rejection once at
    the cap; Pro is unlimited (`maxActiveProducts: null` skips the check
    entirely). The edit branch checks the same cap, but only when the update
    flips `is_active` false→true (a reactivation) — fetches the existing
    row first so an ordinary edit to an already-active product is never
    blocked just because the vendor is at cap on other rows. Both checks are
    a fast, friendly-error first line of defence only — the enforcement that
    actually holds is in `supabase/migrations/0011_product_limit_rls.sql`
    (insert) and `0012_product_reactivation_limit.sql` (reactivation),
    which a direct browser-side `from('products').insert/update(...)`
    cannot route around: RLS policies/functions catch the ordinary
    single-row case, and statement-level triggers with transition tables
    are what hold for a multi-row batch, which a per-row `WITH CHECK`
    structurally cannot see the whole of.
  - `getProductMovements`: capped at `movementHistoryLimit` rows (10) on
    Free; unlimited on Pro (`movementHistoryLimit: null` skips `.limit()`).
  - `exportProductMovementsCsv(productId)`: Pro-only (`entitlement.csvExport`),
    returns the product's full stock-movement ledger as CSV text
    (`date,reason,delta,note` header + one row per movement) or a friendly
    rejection on Free. Fields are RFC 4180-escaped (`csvField` helper) so a
    note containing a comma, double quote, or newline can't corrupt the
    output. Not yet wired to a download button in `product-detail.tsx` —
    action only, UI follow-up.

  Tested in `actions.test.ts`.

Both `.dom.test.tsx` files rely on `test/setup.ts`'s global RTL `cleanup()`
and no-op `ResizeObserver` stub (needed for the Radix `Switch`/`Select`
primitives each form uses) instead of declaring their own.

## Parent

[dashboard](../README.md)
