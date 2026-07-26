# Stock-take / cycle-count session

## Problem

Reconciling a physical count against the system today means opening each
product one at a time and typing a delta into the generic `adjustment`
reason via `recordStockMovement`. For a vendor closing up for the night and
counting everything on the table, that's N separate form submissions with
no way to see "what changed this session" afterward — the ledger just shows
N scattered `adjustment` rows mixed in with every other adjustment they've
ever made, with no shared marker tying them together or any variance
summary (how many products were over/under, by how much, in dollar terms).

## Approaches considered

**(a) New `stock_take_sessions` table + `session_id` on `stock_movements`,
bulk-write RPC.** A session row (`id`, `vendor_id`, `started_at`,
`completed_at`, `note`) groups movements via a nullable FK column added to
`stock_movements`. A new `stockkit.record_stock_take(p_session_note,
p_lines jsonb)` RPC creates the session and loops the submitted
`(product_id, counted_qty)` lines inside one function body — same implicit
transaction as `record_stock_movement`, so a rejection (e.g. a product
deleted mid-session) rolls back the whole count, not just one line.
Queryable, indexed, explicit — the right shape for "show me count history."

**(b) No new table — a shared note convention.** The UI stamps every
movement in a batch with an identical auto-generated note
(`"Stock take 2026-07-26T21:04"`), and a session "view" is just `GROUP BY
note`. Zero migration cost, but string-matching as a grouping key is
fragile (a vendor editing the note breaks grouping, no FK integrity, no
index), and there's no session record to attach `completed_at`/summary
metadata to later (e.g. a future valuation snapshot).

**(c) Client-side batching only.** Collect all counts in the browser, fire
N sequential `recordStockMovement` calls sharing one note, no new RPC at
all. Simplest to ship, but not atomic — a network failure on line 7 of 12
leaves 6 products counted and 6 not, with no rollback and no clear signal
to the vendor about which lines actually landed.

**Recommendation: (a).** The atomicity gap in (c) is the deciding factor —
a stock take is inherently a single user action over N rows, and a partial
apply is worse than useless (it corrupts trust in the count without the
vendor necessarily noticing which rows failed). (a) costs one migration and
one RPC beyond (c), and reuses `record_stock_movement`'s existing
below-zero guard per line inside the same transaction.

## Chosen design

**Migration:** `stockkit.stock_take_sessions` (`id uuid pk`, `vendor_id
uuid not null references vendors`, `started_at timestamptz not null default
now()`, `completed_at timestamptz`, `note text`). Add `session_id uuid
references stockkit.stock_take_sessions(id)` to `stock_movements` (nullable
— every other movement reason leaves it null). RLS: vendor-owns-own-row on
the new table, matching the `products_vendor_all` pattern (`FOR ALL USING
(vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid())`).

**RPC:** `stockkit.record_stock_take(p_note text, p_lines jsonb) RETURNS
stockkit.stock_take_sessions`. `p_lines` is `[{product_id, counted_qty}]`.
Inserts the session row, then loops lines: for each, computes `delta =
counted_qty - current on_hand`, skips zero-delta lines (no-op counts don't
need a ledger row), and inserts a `stock_movements` row with
`reason='adjustment'`, `session_id` set, applying the same UPDATE-then-
INSERT shape as `record_stock_movement` (kept as its own function, not a
call-into, since RPCs can't easily nest transactions-within-loops without
duplicating the guard logic anyway). SECURITY INVOKER — same reasoning as
`record_stock_movement`: caller is always the authenticated vendor.

**Server action:** `recordStockTake(input)` in a new
`src/app/dashboard/stock-take/actions.ts`, validated by a Zod
`stockTakeFormSchema` (`note` optional string, `lines` array of `{productId:
uuid, countedQty: nonnegative number}`, min length 1), returning
`ActionResult<{ session: StockTakeSession, variance: VarianceLine[] }>`.

**UI:** `/dashboard/stock-take`, a checklist page listing every active
product with its current `on_hand` (font-mono, read-only) beside a counted-
quantity input (font-mono, defaults blank, not pre-filled with current
value — forces an actual count rather than an accidental no-op tab-through).
A live-computed diff column appears once a count is entered. Submit posts
all entered lines at once; untouched products are simply omitted from
`p_lines`. On success, a variance summary (X over, Y under, Z unchanged,
total value delta) replaces the checklist.

## Testing considerations

pgTAP (`supabase/tests/rls.test.sql`): a vendor can't create a session or
movement rows under another vendor's `vendor_id`; a count line that would
take `on_hand` negative rejects the whole RPC call, not just that line
(transactional rollback, so a second vendor's session is unaffected).
Vitest: `stockTakeFormSchema` rejects empty `lines`/negative counts; the
diff-calculation helper (counted − current) is a pure function, unit-tested
directly; a `.dom.test.tsx` for the checklist page covering the empty-
products-list case and the variance-summary render.

## Out of scope

Barcode/scanner-assisted counting, offline entry (counting with no
connectivity, syncing later), photo-based counting, scheduled/recurring
stock-take reminders, partial/location-scoped counts (count only a subset
of products) — all real asks, none needed for a first cut.

## Open questions

- Should `counted_qty` be required for every active product before submit,
  or is a partial count (some products left blank = "not counted this
  session") acceptable? Leaning partial-allowed, since a vendor may
  deliberately skip slow-moving items.
- Does a completed stock-take session need to be viewable/re-openable
  later (a "count history" page), or is the ledger's existing per-product
  movement history (already shown via `getProductMovements`) sufficient
  for now? Leaning: ledger is sufficient for v1; a dedicated session list
  view is a fast-follow, not blocking.

## Interactions with sibling specs

- `2026-07-26-customer-return-movement-reason-design.md` — considered
  whether stock-take corrections need their own reason value
  (`count_correction`) instead of reusing `adjustment`. Decided against:
  the new `session_id` column is what makes a stock-take movement
  distinguishable from an ad-hoc adjustment; a separate reason would be
  redundant and would need its own CHECK-constraint migration for no
  added query value.
- `2026-07-26-inventory-valuation-export-design.md` — a completed stock-take
  session is a natural trigger point for a valuation snapshot (the vendor
  has just confirmed real counts, so "value as of this stock-take" is a
  meaningful point-in-time figure). Not required for v1, but the
  `completed_at` timestamp on `stock_take_sessions` is there specifically
  so a future export feature can key off it.
- `2026-07-26-raw-material-finished-good-linking-design.md`,
  `2026-07-26-product-variants-and-bundles-design.md` — both change what a
  "product row" is (raw materials, variants, bundles). This spec's
  checklist is written against the current flat `products` table; if either
  of those land first, the stock-take checklist needs to decide whether raw
  materials/variants get their own count lines too (likely yes, no
  structural change needed — they'd still be rows in `products` or a
  sibling table with the same `id`/`on_hand` shape).
- `2026-07-26-reserved-vs-available-stock-design.md` — if reserved stock
  ships, the counted quantity in a stock-take is *total physical* stock,
  not *available* stock; the diff calculation here would need to compare
  against `on_hand` (physical), not `available`, and that distinction
  should be made explicit in whichever spec lands second.
- `2026-07-26-time-aware-low-stock-alerting-design.md` — no direct
  interaction; a stock-take changing `on_hand` will naturally feed into
  whatever alerting logic already reads that column.
