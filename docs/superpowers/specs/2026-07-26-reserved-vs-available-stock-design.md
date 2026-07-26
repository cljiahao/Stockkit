# Reserved vs. available stock — design

## 1. Problem

`stockkit.products.on_hand` is a single number meaning "physically here right
now." The dashboard (`(overview)/page.tsx`) and `stock.ts`'s `stockStatusFor`
both treat that number as the whole truth: value = `on_hand * unit_cost_cents`,
status = `out` at `on_hand <= 0`, `low` at `on_hand <= low_stock_threshold`.

Three scenarios from the pain-point sweep all want a second number —
"committed but not truly sellable right now":

- **Subscription boxes** — next month's boxes are already spoken for out of
  current stock.
- **Consignment** — goods physically sit in someone else's shop; still
  "owned," not available to sell locally.
- **Market-day allocation** — a vendor loads a subset of total stock into the
  car for today's market; the rest is real but not on the table.

**Are these one concept?** No — and forcing them into one `reserved_quantity`
number would be wrong. Subscription commitment is a _forward_ claim against
future fulfillment (recurring, roughly predictable). Consignment is a
_location_ split (stock exists, just not here — arguably a multi-location
problem, not a reservation problem). Market-day allocation is a _temporal_
snapshot (today's subset), not a standing reservation at all — it resets
every market day. Treating all three as "subtract a number from on_hand"
would produce a figure that's technically present but semantically meaningless
across the three cases; a vendor reading "12 reserved" wouldn't know if that's
next month's subscribers, stock at a shop across town, or just what's still
in the closet after loading the car.

## 2. Approaches considered

**(a) Single `reserved_quantity` column on `products`**, vendor-maintained by
hand, `available = on_hand - reserved_quantity` surfacing in dashboard/alerts.
Cheapest to build. But per the analysis above, one number can't honestly
represent three different concepts — it would become a junk-drawer field
vendors use inconsistently, and `available` would be a number nobody trusts.

**(b) `stock_reservations` table** (`product_id`, `quantity`, `reason` enum
or free text, `expires_at`/note, own RLS), allowing multiple concurrent,
labeled reservations with their own lifecycle. Structurally correct — each
reservation is legible on its own — but this is real schema/RLS/UI surface
for three use cases none of which are confirmed to matter to stockkit's
actual current user (a single small vendor tracking their own stock, not yet
running subscriptions or consignment relationships).

**(c) Defer.** stockkit's AGENTS.md already scopes this app as "manual stock
in/out and costing only" for v1, standalone, no cross-kit sales sync built
yet. None of the three scenarios have been validated as common for stockkit's
target user — they're inferred from general small-business research, not
from vendor feedback (`stockkit.feedback`/`support_message` have no signal
here yet). Building (b) speculatively risks the exact "designing for
hypothetical future requirements" this project's own conventions warn against.

## 3. Chosen design: defer

Recommend **not building this now**. Revisit if/when:

- Vendor feedback or support messages actually mention overselling due to
  committed-but-unavailable stock, or
- The qkit sales-sync integration (already flagged as a real planned
  cross-kit feature) lands and creates a concrete "sold via qkit but not yet
  fulfilled" case that needs a real reservation concept, not a guessed one.

No schema placeholder is worth adding preemptively — `products` has no
NOT NULL/CHECK constraints that a future `reserved_quantity` or
`stock_reservations` table would conflict with, so deferring costs nothing
migration-wise later.

## 4. Testing considerations

N/A — no build.

## 5. Out of scope

Building any of (a)/(b) now. Multi-location inventory (consignment's real
shape) is a separate, larger concept if ever pursued.

## 6. Open questions

What signal (vendor count, feedback volume) would justify revisiting this?
Not defined here — worth setting a concrete bar rather than "someday."

## 7. Interactions with sibling specs

- `2026-07-26-raw-material-finished-good-linking-design.md` — independent;
  no overlap.
- `2026-07-26-product-variants-and-bundles-design.md` — independent.
- `2026-07-26-stock-take-cycle-count-design.md` — independent; a stock-take
  reconciles `on_hand` itself, not a reserved figure.
- `2026-07-26-time-aware-low-stock-alerting-design.md` — if reserved stock
  were ever built, alerting would need to key off `available`, not `on_hand`.
  Since this spec defers, alerting can proceed against `on_hand` as-is with
  no dependency.
- `2026-07-26-customer-return-movement-reason-design.md` — independent.
- `2026-07-26-inventory-valuation-export-design.md` — independent; valuation
  should still be based on `on_hand`, not a speculative `available`.
