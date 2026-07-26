# docs/superpowers/specs

Design specs produced by the `superpowers:brainstorming` skill before
implementation — one file per feature, named `YYYY-MM-DD-<topic>-design.md`.

- `2026-07-22-landing-login-color-refresh-design.md` — landing/login
  structural parity with qkit/loopkit/paykit, plus the primary color refresh.
- `2026-07-22-landing-visual-refresh-design.md` — the follow-up visual pass
  (hero illustration, typography, navbar, motion) once structural parity
  alone turned out not to be enough.
- `2026-07-26-raw-material-finished-good-linking-design.md` — a
  component/raw-material product linked to a finished-good product, consumed
  atomically via a new `record_production` RPC.
- `2026-07-26-product-variants-and-bundles-design.md` — SKU variant grouping
  (`parent_product_id`) and composite bundle products (`bundle_components` +
  a fan-out RPC), flagged as sharing a mechanism with the raw-material spec.
- `2026-07-26-stock-take-cycle-count-design.md` — a batch physical-count
  session (`stock_take_sessions`), one atomic RPC covering every counted
  product, variance surfaced per session.
- `2026-07-26-reserved-vs-available-stock-design.md` — **deferred**: the
  subscription/consignment/market-allocation scenarios aren't one concept;
  no schema change recommended until there's real vendor signal.
- `2026-07-26-time-aware-low-stock-alerting-design.md` — a vendor-declared
  seasonal window (`active_months`) suppresses low-stock alerts off-season,
  instead of a sales-velocity proxy stockkit has no real data to support.
- `2026-07-26-customer-return-movement-reason-design.md` — adds a `'return'`
  stock-movement reason distinct from `restock`/`adjustment`.
- `2026-07-26-inventory-valuation-export-design.md` — on-demand CSV export
  of a dated inventory valuation via a Route Handler, no persisted snapshot
  table.
- `2026-07-26-shared-document-photo-import-design.md` — **roadmap note,
  deferred**: invoice/receipt photo scanning, recommended as a future
  shared `merqo`-level (BYOK) capability, not a stockkit-only feature.
