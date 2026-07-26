# Inventory valuation export — design

## Problem

The dashboard overview already computes a live total inventory value
(`on_hand * unit_cost_cents`, summed over active products —
`src/app/dashboard/(overview)/page.tsx:53`, formatted via
`centsToDollarString`). That number is useful at a glance but useless as a
document: it changes the moment a vendor logs a restock, it's not scoped to
a specific date, and there's no way to hand it to anyone. A vendor asked by
their insurer for "current inventory value for a policy renewal," or by an
accountant for "inventory on hand at year-end," or by a lender for "proof of
stock on hand," needs something they can save, print, or attach to an
email — not a live webpage.

## Approaches considered

**(a) On-demand CSV export, no new storage.** A button on the products page
triggers a download of every active product's name/unit/on_hand/
unit_cost_cents/line-value, a total row, and a "generated at" timestamp. The
"point in time" is simply whenever the vendor clicks export — nothing is
persisted. Cheapest to build, matches how most SMB tools handle this (Zoho
Inventory, inFlow's count-sheet export both work this way), and needs zero
schema change.

**(b) Persisted `valuation_snapshots` table.** Store a snapshot row (vendor,
timestamp, total_value_cents, maybe a JSON line-item array) so a vendor can
later ask "what was my inventory worth on March 1st" without having
remembered to export that day. Genuinely more useful as an audit trail, but
it's real schema + RLS + a decision about retention/growth (one row per
export, forever) for a need that's speculative right now — nothing in the
sweep's pain points asked for _historical_ valuation, only _current_,
documented valuation.

**(c) PDF instead of/alongside CSV.** More presentable for a bank or
insurer than a raw CSV, but pulls in a PDF-generation dependency (nothing in
`package.json` does this today) for a formatting upgrade over a CSV any
spreadsheet app opens and prints fine.

**Recommendation: (a) only.** CSV-on-demand solves the stated problem
completely. (b) is premature — add it later if vendors actually ask to look
backward, not preemptively. (c) is a nice-to-have polish pass, not core;
CSV is the YAGNI-correct starting point and a vendor can already
print-to-PDF from their browser if they need a PDF today.

## Chosen design

**Route Handler, not a Server Action.** Server Actions return
`ActionResult<T>` (JSON-shaped) — they're not the right fit for streaming a
file download. A `GET` Route Handler returning `Content-Type: text/csv` and
a `Content-Disposition: attachment` header is the standard Next.js pattern
for downloads, and this app already has a Route Handler precedent at
`src/app/api/health/route.ts`.

- **New file:** `src/app/api/inventory/export/route.ts`. Per
  `scripts/check-route-logging.mjs` (enforced repo-wide, not just on
  `/health`), the handler must be wrapped in `withLogging` like every other
  route in `src/app/api/`.
- **Auth/RLS:** uses `createServerClient()` exactly like every existing
  page/action — never the service-role client. Unauthenticated → `401`. The
  query (`supabase.from('products').select('*').order('name')`) is already
  scoped to the caller's own rows by `products_vendor_all` RLS; no
  `vendor_id` filter needed in the query, same as `products/page.tsx` today.
- **Columns:** name, unit, unit_cost_cents (rendered as dollars via
  `centsToDollarString`, matching every other money display in the app),
  on_hand, line value (`on_hand * unit_cost_cents`, dollars), plus a final
  total row. A header row states "Generated <ISO timestamp>".
- **Active vs. inactive:** include both, with an `Active`/`Inactive` column
  — an insurer or accountant wants the full picture, not just what's
  currently for sale; the overview dashboard's `is_active` filter is a
  _display_ choice for the live stats card, not a valuation-completeness
  one.
- **CSV generation:** no library needed — it's a flat, small (one row per
  product) table; hand-build the string with a small `toCsvRow` helper that
  quotes/escapes fields (a product name could contain a comma).
- **Trigger:** a "Download inventory report" button on
  `src/app/dashboard/products/page.tsx` (or `products-workspace.tsx`'s
  header, next to "Add product"), a plain `<a href="/api/inventory/export">`
  — no client JS needed, the browser's native download handling does the
  work.

## Testing

Route Handler unit test (`route.test.ts`, matching
`src/app/auth/callback/route.test.ts`'s convention — logic-only, no DOM):
unauthenticated → 401; authenticated with products → CSV body contains
expected header + row count + correct total; authenticated with zero
products → CSV with just the header/total-zero row, not an error. A
`toCsvRow`/escaping unit test for the comma-in-name case.

## Out of scope

Historical/persisted snapshots (approach b), PDF export (approach c),
scheduled/recurring exports, any format beyond CSV, filtering the export by
date range or category (there's no category concept yet).

## Open questions

- Should the export include the movement ledger (audit trail) or only the
  current-state snapshot? Leaning current-state-only — the ledger is
  already viewable per-product via `getProductMovements`, and mixing "state"
  and "history" into one export muddies what the document is _for_.
- Currency is implicitly SGD everywhere else in the app (`formatPrice`'s
  `en-SG` locale) but the CSV as designed omits a currency symbol per-cell
  (matching `centsToDollarString`'s plain-decimal convention for
  exports/CSV, per its own doc comment) — worth a header note stating the
  currency explicitly so the document is unambiguous out of context.

## Interactions with sibling specs

- **stock-take-cycle-count** — a completed stock-take/reconciliation
  session is a natural moment to prompt "your counts just changed valuation
  materially — download an updated report?" Not required for either spec to
  ship independently; a UI nicety to consider once both exist.
- **raw-material-finished-good-linking** — if/when raw-material lots get
  their own cost-carrying rows, the export's per-product cost picture may
  need to account for component cost roll-up rather than a flat
  `unit_cost_cents`. Not a blocker now since that spec is itself still
  design-stage; this export reads whatever `unit_cost_cents` means at the
  time.
- **product-variants-and-bundles** — if bundles land, a bundle's "value" is
  ambiguous (sum of components vs. its own price) and the export would need
  a rule for it. Out of scope until that spec is chosen for
  implementation.
- **reserved-vs-available-stock** — if reserved/committed quantities are
  added, this export should clarify whether valuation is computed on total
  on-hand or only available-to-sell stock. Not a blocker; note it for
  revisit when that spec lands.
- **time-aware-low-stock-alerting**, **customer-return-movement-reason** —
  no interaction; both are independent of valuation.
