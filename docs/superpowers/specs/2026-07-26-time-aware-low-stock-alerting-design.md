# stockkit — time-aware low-stock alerting

Date: 2026-07-26

## 1. Problem

`stockStatusFor` (`src/lib/stock.ts`) classifies a product purely from two
static numbers: `on_hand <= 0` → out, `on_hand <= low_stock_threshold` →
low, else ok. The dashboard overview (`(overview)/page.tsx`) filters on the
same two fields to build the "Needs attention" list. There is no notion of
time, season, or how fast a product actually moves.

Concrete failure: a vendor sells a holiday-only sticker pack once a year.
They set `low_stock_threshold = 5` so they get warned before running out
during the one selling window. For the other ~11 months, `on_hand` sits at
whatever's left — often at or below 5 — so the product shows "Low stock"
and sits in "Needs attention" continuously, all year, for no actionable
reason. The vendor either learns to ignore the alert (defeating its purpose
for every product) or keeps `on_hand` artificially inflated to silence it
(defeating the dashboard's accuracy).

The deeper issue: a fixed threshold with no sense of "is this product
currently being sold" or "how fast does it move" is a guess, not a signal.

## 2. Approaches considered

**A. Derive a velocity proxy from `stock_movements` history.** Compute a
rolling window (e.g. trailing 30/60 days) of negative deltas
(`waste`/`adjustment`/manual stock-out logging) per product, and only
surface a low-stock alert if the product has *recent* outbound movement —
silence products with no recent activity. Cheap: no schema change, pure
read-time aggregation over existing data. But stockkit is manual-entry
only — there is no real sales feed (see AGENTS.md: tying stock movement to
qkit's sales is explicitly "not built"). `stock_movements` records whatever
the vendor bothers to log, which for a seasonal item is exactly the
low-signal, low-frequency data this problem is about. Building a velocity
model on top of sparse, vendor-discretion data risks looking
authoritative while actually being noise — worse than the current honest
"just a threshold."

**B. Vendor-authored seasonal window.** Add an optional active-date-range
to a product (e.g. `season_start_month`/`season_end_month`, or a simpler
`is_seasonal` + `season_months: int[]`). Outside the active window,
low-stock alerts are suppressed (still visible on the product page, just
excluded from the dashboard's urgent list and low-stock count). Simple,
vendor-controlled, requires no inference from noisy data — the vendor
already knows their own selling season better than any derived signal
could guess from stockkit's own sparse ledger. Cost: one more field for the
vendor to set and maintain per seasonal product; does nothing for
non-seasonal products whose real problem is "I don't know how fast this
moves," which this doesn't solve.

**C. Defer entirely — wait for qkit sales-sync.** The actually-correct
signal is real sales velocity, which only exists once the deferred
cross-kit "qkit sales sync" project (HTTP+bearer-secret, per the
project-wide cross-kit convention — see `merqo` schema notes) lands and
stockkit starts receiving real sell-through events instead of manual
ledger entries. Building either A or B now risks throwing work away once
real velocity data exists. But A and C are avoidable throwaway risk (A is
weak enough it may never be worth building at all); B is not — a
vendor-declared season is orthogonal to *how* velocity is measured and
stays useful even after real sales data exists (it still tells you "don't
alert in the off-season" on top of whatever velocity signal you have
later).

## 3. Chosen design

**B, vendor-authored seasonal window** — the only option that's both
buildable now with data that actually exists, and not throwaway once real
sales data eventually lands. Explicitly reject A: building a velocity
proxy on manual, sparse, vendor-discretion data would present false
confidence and isn't worth the complexity given how thin the signal is.

**Schema** — new migration `000X_product_seasonality.sql`:

```sql
ALTER TABLE stockkit.products
  ADD COLUMN active_months SMALLINT[] NOT NULL DEFAULT '{}';
-- Empty array = always active (current behavior, default for every
-- existing/non-seasonal product — no migration-time backfill needed).
-- Non-empty = 1-12 values, the calendar months this product is expected
-- to sell; low-stock/out-of-stock alerts are suppressed outside them.
```

An array of month numbers (not a date range) handles both single-season
items (`[11, 12]`) and vendors who don't think in start/end dates. Update
`src/lib/types.ts`'s `products` Row/Insert/Update to match, and extend
`productFormSchema` (`src/lib/schemas.ts`) with an optional
`active_months: z.array(z.number().int().min(1).max(12)).max(12).default([])`.

**Classification change** — `stockStatusFor` itself stays pure (still just
`on_hand`/`threshold` math; it's also used by the products workspace's
status chips, which should keep showing true status year-round — a vendor
editing a seasonal product still needs to see its real on-hand). Add a
separate `isAlertSuppressed(activeMonths: number[], now: Date): boolean`
in `src/lib/stock.ts` that returns `false` when `activeMonths` is empty,
else `true` when the current month isn't in the array. The dashboard
overview's `lowStock`/`outOfStock`/`urgent` filters gain
`&& !isAlertSuppressed(p.active_months, new Date())` — this is UI-surface
filtering only, not a change to what "low"/"out" mean.

**Form UI** — `ProductForm` gains an optional multi-select (12 month
toggles or a `ToggleGroup`, matching the existing shadcn `ToggleGroup`
usage in `feedback-form.tsx`/`support-form.tsx`) under a "Seasonal
product" disclosure, defaulting to none selected (= always active).

## 4. Testing considerations

- `isAlertSuppressed` is pure — unit-test the boundary cases directly:
  empty array (never suppressed), current month present, current month
  absent, December/January wraparound (no special handling needed since
  it's a plain array membership check, not a range).
- `productFormSchema` — reject out-of-range month numbers, dedupe/cap at
  12 (Zod `.max(12)` on array length, not value dedup — note as an open
  question below).
- Dashboard overview test: a product with `on_hand` below threshold but
  `active_months` excluding the current month is absent from `urgent`/
  `lowStock`/`outOfStock` counts; present when the current month matches.
- `Date.now()`-dependent test: inject `now` as a parameter (as specified
  above) rather than calling `new Date()` inside the pure function, so
  tests can pass a fixed date without mocking global time.

## 5. Out of scope

- Real sales-velocity computation or forecasting (approach A, rejected).
- ML-based demand prediction.
- Per-product custom suppression rules beyond a month list (e.g. "suppress
  unless within 30 days of last year's peak").
- Retroactively suggesting `active_months` from movement history — pure
  vendor input only.

## 6. Open questions

- Should `active_months` values be deduplicated/sorted server-side, or is
  a raw Zod array (allowing e.g. duplicate months) acceptable since it's
  only ever read as a membership check? Leaning toward leaving as-is —
  duplicates are harmless for the `isAlertSuppressed` membership check and
  not worth extra validation complexity.
- Should the "Needs attention" card show a small "seasonal — hidden until
  {month}" hint for suppressed-but-actually-low products, so a vendor
  doesn't forget a seasonal item exists when restocking ahead of season?
  Leaning yes, but it's a UI nicety that can land after the core
  suppression logic, not a blocker.

## 7. Interactions with sibling specs

- **`2026-07-26-raw-material-finished-good-linking-design.md`** — no
  direct interaction; `active_months` applies at the `products` row level
  regardless of whether that row is a raw material or finished good.
- **`2026-07-26-product-variants-and-bundles-design.md`** — if variants
  ship, seasonality likely belongs on the parent/group level, not each
  variant row, to avoid a vendor setting the same months N times. Flag for
  whichever spec lands second to reconcile.
- **`2026-07-26-stock-take-cycle-count-design.md`** — no interaction.
- **`2026-07-26-reserved-vs-available-stock-design.md`** — if reserved
  stock ships, alerting should threshold against *available*
  (`on_hand - reserved`), not raw `on_hand`. This spec's suppression logic
  is orthogonal (applied on top of whichever quantity is used) but the
  dependency should be noted when that spec lands.
- **`2026-07-26-customer-return-movement-reason-design.md`** — no
  interaction.
- **`2026-07-26-inventory-valuation-export-design.md`** — no interaction;
  valuation is a point-in-time snapshot, unrelated to alert suppression.
- **qkit sales sync (deferred, out-of-repo)** — the real long-term fix for
  velocity-aware alerting. This spec's vendor-authored season window is
  designed to remain useful even after that lands, not to be superseded by
  it.
