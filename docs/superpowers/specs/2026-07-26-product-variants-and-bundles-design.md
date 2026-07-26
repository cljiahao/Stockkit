# Product variants and bundles

## Problem

`stockkit.products` (migration `0001_initial_schema.sql`) is one flat row per SKU, with no relationship between rows. Two distinct gaps fall out of that:

**Variant explosion.** A vendor selling one sticker design in 3 sizes × 2 finishes creates 6 `products` rows. They think of it as "one design," but `products-workspace.tsx`'s list shows 6 unrelated-looking entries sorted alphabetically by `name` (`.order('name')` in `products/page.tsx`), so a vendor scrolling for "the design" has to visually reconstruct the grouping themselves, typically by prefixing names ("Cat sticker — 2in — matte", "Cat sticker — 2in — glossy", …). Phone-case sellers hit this worse (device model × color × material can be dozens of rows).

**Bundles/composite products.** A "sticker pack of 5" or a gift set sold as one SKU should draw down units of one or more underlying `products` on sale. Today there is no way to express "selling 1 of X consumes N of Y" at all — `stockkit.record_stock_movement` (`0002_record_stock_movement.sql`) only ever touches the single `p_product_id` it's given.

## Approaches considered

### Variants

- **(a) `parent_product_id` self-reference + `variant_label` text column on `products`.** Minimal schema change (two nullable columns), reuses the existing table and its RLS policy (`products_vendor_all`) as-is. A "design" is just a product row with `parent_product_id IS NULL`; its variants are rows pointing at it.
- **(b) Separate `product_groups` table**, products reference a `group_id`. Adds a second table and a naming concept ("group") on top of what (a) already gives — no behavior (a) can't express, just more surface area. Reject: no case in the sweep needs a group to exist independently of having at least one member product.
- **(c) UI-only clustering by name prefix**, no schema change — parse `products.name` on a delimiter and visually group in the list. Cheap, ships fast, but fragile (breaks the moment a vendor's naming doesn't follow the convention) and doesn't fix the real ask (filtering, per-variant low-stock rollups, a "add another variant" action pre-filling shared fields). Worth doing as a zero-cost stopgap if (a) is delayed, but not a substitute.

**Recommendation: (a).**

### Bundles

- **(a) `bundle_components` join table**: `bundle_product_id`, `component_product_id`, `quantity_per_bundle`. A new RPC fans a bundle-level movement out to every component in one transaction. Correctly keeps `stock_movements` as the source of truth for every unit that actually moved.
- **(b) Informational-only bundle** (no stock effect; vendor manually adjusts components separately). Rejected — this is the status quo in spirit (a vendor already *can* just create a "Sticker pack of 5" product today and manually log adjustments on the 5 components) and doesn't solve the actual pain point, which is exactly that manual double-entry.

**Recommendation: (a).**

## Chosen design

**Variants** — extend `products`:

```sql
ALTER TABLE stockkit.products
  ADD COLUMN parent_product_id UUID REFERENCES stockkit.products(id) ON DELETE SET NULL,
  ADD COLUMN variant_label TEXT;

CREATE INDEX products_parent_product_id_idx ON stockkit.products(parent_product_id);
```

`products_vendor_all`'s existing `WITH CHECK (vendor_id = auth.uid())` guards the row itself but not the *referenced* parent's owner — a vendor could otherwise point `parent_product_id` at another vendor's product id. Add a `BEFORE INSERT OR UPDATE` trigger (same pattern as `products_updated_at`) that raises if `parent_product_id`'s `vendor_id` differs from `NEW.vendor_id`, and rejects `parent_product_id = id` (self-parent) and `parent_product_id` pointing at a row that itself has a non-null `parent_product_id` (no nested variants — one level only).

App side: `productFormSchema` gains optional `parent_product_id`; `product-form.tsx` gets a "This is a variant of…" picker (searches the vendor's own non-variant products); `products-workspace.tsx`'s list groups by `parent_product_id ?? id`, rendering the parent's name once with variant rows nested/indented under it, `variant_label` shown as a suffix chip. Low-stock/out-of-stock counts on the dashboard overview continue counting each row individually (a "size L, matte" being low doesn't mean the whole design is low) — no change needed there.

**Bundles** — new table:

```sql
CREATE TABLE stockkit.bundle_components (
  bundle_product_id     UUID    NOT NULL REFERENCES stockkit.products(id) ON DELETE CASCADE,
  component_product_id  UUID    NOT NULL REFERENCES stockkit.products(id) ON DELETE RESTRICT,
  quantity_per_bundle    NUMERIC NOT NULL CHECK (quantity_per_bundle > 0),
  PRIMARY KEY (bundle_product_id, component_product_id),
  CHECK (bundle_product_id <> component_product_id)
);
```

`ON DELETE RESTRICT` on the component side deliberately blocks deleting a product that's still a bundle's ingredient — forces the vendor to unlink first, consistent with the app's existing bias toward explicit, non-silent state changes. RLS: `FOR ALL USING/WITH CHECK` against `EXISTS (SELECT 1 FROM stockkit.products WHERE id = bundle_product_id AND vendor_id = auth.uid())`, same shape as `products_vendor_all`; a trigger (or the same check, doubled) also validates `component_product_id`'s owner matches, and rejects a component that is itself a bundle (no bundle-of-bundles).

New RPC, same atomicity pattern as `record_stock_movement`:

```sql
stockkit.record_bundle_movement(p_bundle_product_id uuid, p_bundle_delta numeric, p_reason text, p_note text)
```

In one transaction: applies `p_bundle_delta` to the bundle product itself via the existing `record_stock_movement` logic (a bundle is a normal `products` row with its own `on_hand`, so "units of this bundle assembled/sold" stays a real, visible number), then for each `bundle_components` row applies `p_bundle_delta * quantity_per_bundle` (negated, since consuming a component moves opposite to the bundle direction) to the component via the same core update+insert logic. If any component would go below zero, the whole call rolls back — nothing partially fans out.

UI: `product-form.tsx` gains a "Bundle contents" section (only shown/relevant for a product with `bundle_components` rows); the stock-log form, when logging against a bundle product, calls `record_bundle_movement` instead of `record_stock_movement` and shows the resulting component deltas in the success toast before confirming.

## Testing considerations

- pgTAP: RLS on `bundle_components` (cross-vendor insert/select rejected both directions); trigger rejects self-bundle, nested-variant, nested-bundle, cross-vendor `parent_product_id`; `record_bundle_movement` atomicity (a component-would-go-negative failure leaves bundle `on_hand` and all components unchanged); grants match the exact ops the policies allow (per `0001`'s own convention).
- Vitest: `productFormSchema` accepts/rejects `parent_product_id`; `products-workspace.tsx` grouping renders variants nested under their parent and handles a variant whose parent was deleted (`ON DELETE SET NULL` — it becomes a top-level product, not an error); bundle contents form validates `quantity_per_bundle > 0`.

## Out of scope

- Full attribute-matrix variants (Shopify-style "Size × Color" auto-generated grid) — `variant_label` is free text, matching the existing free-text `unit` field's philosophy; no attribute schema.
- Per-variant pricing tiers beyond the existing per-row `unit_cost_cents` (already supported — no work needed).
- Bundle-of-bundles (nesting) — explicitly rejected above.
- Auto-suggesting bundle contents from sales patterns — no sales data exists in stockkit to learn from.

## Open questions

- Should a bundle product's own `on_hand` be meaningful (assembled-bundles-in-stock) or should bundles always have `on_hand` pinned to 0/unused, with only the component fan-out mattering? This spec assumes the former (real, trackable "bundles assembled" count) — worth confirming against how vendors actually think about pre-assembled vs. assembled-to-order bundles.
- No `'sale'` reason exists in `stock_movements.reason` today (only `restock`/`waste`/`adjustment`/`initial`) — see Interactions below.

## Interactions with sibling specs

- **`2026-07-26-raw-material-finished-good-linking-design.md`** — structurally the same shape as bundles: "one unit of product A's movement fans out to N units of product(s) B." **Recommend these two specs share one underlying mechanism** (one components/BOM table + one fan-out RPC), differing only in UI vocabulary (raw-material spec frames it as "producing a finished good consumes raw material," this spec frames it as "selling a bundle consumes components") and in movement direction (raw-material linking likely fans out on `restock` of the finished good; bundles fan out on any reason). Building two parallel `*_components` tables and two fan-out RPCs would be pure duplication of the exact same atomicity/RLS problem. If that spec is drafted independently, its author should reconcile against this one before either is implemented.
- **`2026-07-26-stock-take-cycle-count-design.md`** — a stock-take session logging a bundle sale as a negative adjustment should ideally call `record_bundle_movement`, not decrement the bundle row alone (which would silently desync component counts from reality). Stock-take's design should account for bundle products explicitly.
- **`2026-07-26-reserved-vs-available-stock-design.md`** — if bundles get a "reserved" concept, reserving a bundle should reserve its components too. Not addressed here; flag for that spec.
- **`2026-07-26-time-aware-low-stock-alerting-design.md`** — no direct interaction; low-stock counts already treat every `products` row independently, which continues to work per-variant and per-bundle-component.
- **`2026-07-26-customer-return-movement-reason-design.md`** — a returned bundle should reverse the component fan-out too (return 1 bundle → +1 to each component), which only works if returns go through `record_bundle_movement` with the new `return` reason rather than a plain `record_stock_movement` call on the bundle alone. Flag for that spec's author.
- **`2026-07-26-inventory-valuation-export-design.md`** — valuation math should avoid double-counting a bundle's own `unit_cost_cents` and its components' value as separate line items if both carry cost — needs a rule (likely: value bundles at their own `unit_cost_cents`, treat components consumed via bundle sale the same as any other consumption, no special-casing needed since `stock_movements` already carries a `unit_cost_cents` snapshot per row).
