# stockkit — raw-material → finished-good linking

Date: 2026-07-26

## 1. Problem

`stockkit.products` is flat: one row, one `on_hand`, one `unit_cost_cents`.
That models a vendor who buys finished goods and resells them unchanged. A
large slice of small vendors don't work that way — they buy or hold a raw
material and _transform_ it into what they actually sell, often with
variable yield:

- **Stickers**: a sheet of vinyl becomes ~40 stickers per sheet, but exact
  count varies with the print layout; a misprint wastes a sheet with zero
  finished output.
- **Coffee roasting**: green beans lose ~15-20% weight when roasted; the
  loss ratio drifts batch to batch with roast level.
- **3D printing**: a filament spool (tracked by weight) is consumed per
  print; a failed print consumes material and produces nothing sellable.
- **Dye-lot goods** (yarn, fabric, hand-poured candles): two production runs
  of the "same" product aren't interchangeable to the customer — a batch
  needs its own identity even without a raw-material parent, which is the
  same underlying gap (something below the product level needs its own
  identity and quantity).

Today a vendor with this shape either can't represent it in stockkit at all,
or has to fake it: create the raw material as its own `products` row and
manually log two `record_stock_movement` calls per production run (one
`waste`/`adjustment` on the raw material, one `restock` on the finished
good) — no atomicity, no recorded relationship between the two rows, and the
vendor does the yield math by hand every time.

## 2. Approaches considered

**A. Manual dual-tracking (status quo, no schema change).** Vendor creates
two `products` rows and logs two separate movements by hand. Zero
engineering cost, but no atomicity (a crash between the two calls leaves
stock inconsistent), no yield history, and nothing stops a vendor from
forgetting the raw-material side entirely. This is the fallback if the
vendor base doesn't actually need more — worth stating plainly rather than
building past it.

**B. `product_components` bill-of-materials table.** A `products` row can
declare it "consumes N units of another `products` row" (a recipe), and a
new RPC atomically decrements the component(s) and increments the finished
good in one call, writing linked ledger rows. Handles the coffee/sticker/3D
-print case well. Doesn't naturally model the dye-lot case (a batch of the
_same_ product needing its own sub-identity), and multi-level BOMs
(component of a component) add real complexity for no current scenario.

**C. `production_runs` + `products.parent_product_id`.** A heavier model:
every production event is its own row (raw material in, finished good out,
recorded yield), and finished-good products optionally point at a raw
material parent. Captures yield history and could extend to batches later,
but is speculative for a v1 — no vendor has asked for a yield trend report
yet, and it's a bigger migration surface.

**Recommendation: B**, scoped down further per YAGNI: a single
`stockkit.record_production` RPC and a nullable `component_product_id` +
`component_qty_per_unit` pair directly on `products` (not a separate join
table — a finished good has at most one declared raw-material input in this
version; multi-component BOMs and the dye-lot/batch-identity case are
explicitly deferred, see §5). This covers the sticker/coffee/filament
scenarios, which are the ones with concrete vendor pain in the sweep, without
building a general recipe engine nobody asked for yet.

## 3. Chosen design

**Migration** (new file, e.g. `0006_production_linking.sql`):

```sql
ALTER TABLE stockkit.products
  ADD COLUMN component_product_id  UUID REFERENCES stockkit.products(id) ON DELETE SET NULL,
  ADD COLUMN component_qty_per_unit NUMERIC CHECK (component_qty_per_unit > 0);
```

Both nullable — most products stay plain finished/standalone goods
(unaffected). `ON DELETE SET NULL` because deleting the raw-material product
shouldn't cascade-delete the finished good; the link just drops (matches the
existing "each row is independently owned" spirit, not a hard dependency).
A `CHECK (component_product_id IS NULL OR component_product_id <> id)`
prevents a product declaring itself as its own component. RLS is unaffected
— `products_vendor_all` already scopes by `vendor_id`; add a trivial check
in `record_production` (below) that both rows belong to the same vendor,
since a raw-hand FK doesn't enforce that on its own the way `vendor_id`
does.

**New RPC**, `stockkit.record_production(p_product_id, p_units_produced,
p_component_delta, p_note)`, `SECURITY INVOKER` (same reasoning as
`record_stock_movement` — caller is always the vendor acting on their own
data):

- Looks up the finished good's `component_product_id`.
- If set: decrements the raw material's `on_hand` by `p_component_delta`
  (the _actual_ amount consumed this run — not
  `p_units_produced * component_qty_per_unit`, because real yield varies;
  that stored ratio is only a UI default/estimate, never authoritative)
  and increments the finished good's `on_hand` by `p_units_produced`, in
  one transaction, writing two `stock_movements` rows sharing a new
  `production_id` (a `gen_random_uuid()` generated once per call) so the
  ledger can show them as one event. Reuses the existing `reason` enum:
  the finished-good row is `restock`, the component row is `waste`-shaped
  but semantically "consumed" — see open question in §6.
- Rejects (raises, rolling back) if either resulting `on_hand` would go
  negative, matching `record_stock_movement`'s existing guard.
- If `component_product_id` is null, behaves exactly like
  `record_stock_movement(p_product_id, p_units_produced, 'restock', ...)`
  — a plain restock — so the UI doesn't need two separate forms for
  components-vs-no-components products.

**`stock_movements`** gains a nullable `production_id UUID` column (no FK
target needed, just a grouping key) so two rows from the same
`record_production` call can be queried/displayed together.

**UI**: `ProductForm` gains an optional "Made from" field (a searchable
select over the vendor's other products) + "units of raw material per unit
produced" — only shown when creating/editing a product, stored as
`component_product_id`/`component_qty_per_unit`. `StockLogForm` (or a new
sibling for products with a component set) replaces the flat quantity input
with two: "units produced" (pre-filled estimate from the ratio, editable)
and "raw material actually used" (defaults to the estimate × units, editable
for real yield), then calls `record_production`. Movement history
(`movement-history.tsx`) groups rows sharing a `production_id` visually.

## 4. Testing considerations

- pgTAP (`supabase/tests/rls.test.sql`): a vendor cannot call
  `record_production` naming another vendor's product as
  `component_product_id` (cross-vendor component theft) — the same-vendor
  check must actually block this, not just rely on each product's own RLS
  row-ownership.
- pgTAP: `record_production` is atomic — forcing the component decrement
  below zero rolls back the finished-good increment too (no partial
  effect), mirroring the existing `record_stock_movement` below-zero test.
- Vitest: `saveProduct`/product-form validation rejects
  `component_product_id === id` (self-reference) even if the DB CHECK is
  bypassed in a unit-test context; `recordProduction` action maps the
  Postgres "would go below zero" error to the same friendly message
  `recordStockMovement` already uses for consistency.
- Vitest: `ProductForm`/`StockLogForm` — component field only renders when
  a component is set; yield-estimate prefill math.

## 5. Out of scope

- Multi-component BOMs (a product consuming 2+ different raw materials) —
  no concrete vendor scenario needs it yet; the single-component column
  pair keeps the migration and RPC simple. If demand shows up, this
  probably becomes its own follow-up spec (a real `product_components`
  join table), not a retrofit of this design.
- Multi-level BOMs (a component that is itself a finished good with its own
  component) — same reasoning, plus it reintroduces cycle-detection
  complexity this design deliberately avoids.
- The dye-lot/batch-identity case (two runs of the _same_ product aren't
  interchangeable) — this needs a `batches` sub-entity under a single
  product, which is a different shape than "consumes another product" and
  is better served by its own spec if a vendor need shows up concretely.
- Full costing/COGS rollup (computing a finished good's `unit_cost_cents`
  automatically from its component's cost × ratio) — `unit_cost_cents`
  stays vendor-entered, same as today; auto-costing is real complexity
  (average cost vs. last-cost vs. FIFO) not justified without a concrete
  ask.
- Rental/checkout inventory — unrelated state machine, flagged separately
  as likely out of scope for stockkit altogether.

## 6. Open questions

- Should the raw-material side of a production event use a new `reason`
  value (e.g. `'consumed'`) instead of reusing `'waste'`? Reusing `waste`
  is semantically wrong (nothing was wasted) but avoids a migration-visible
  enum change; a dedicated reason is more honest but touches the
  `stock_movements.reason` CHECK constraint, `StockMovementReason` type,
  and every place that renders reason labels. Leaning toward a dedicated
  `'consumed'` reason for clarity, but deferring the final call to
  implementation-time discussion since it's a one-line difference either
  way.
- Does `component_qty_per_unit` need enforcement (e.g. warn if actual usage
  drifts >X% from the estimate) or is it purely an editable UI default with
  no validation teeth? Leaning toward no enforcement for v1 — yield
  variance is expected, not an error.

## 7. Interactions with sibling specs

Drafted in parallel; not yet cross-read against each other's final content:

- `2026-07-26-product-variants-and-bundles-design.md` — bundles (a sale
  drawing down multiple finished-good rows) and production linking (a
  restock drawing down a raw-material row) are different directions of
  multi-product relationship; both may end up wanting a similar
  "linked-movements-share-an-id" ledger pattern (`production_id` here vs.
  whatever bundles need) — worth reconciling into one shared grouping
  mechanism at implementation time instead of two parallel ones.
- `2026-07-26-stock-take-cycle-count-design.md` — a stock take that
  recounts a product with a `component_product_id` set should presumably
  also let the vendor recount its raw material in the same session; not
  designed here.
- `2026-07-26-reserved-vs-available-stock-design.md`,
  `2026-07-26-time-aware-low-stock-alerting-design.md`,
  `2026-07-26-customer-return-movement-reason-design.md`,
  `2026-07-26-inventory-valuation-export-design.md` — no direct overlap
  identified; all operate on `products`/`stock_movements` as this design
  leaves their shape, so should compose without conflict.
