# Changelog

## Unreleased

- Added `stockkit.product_components` + `stockkit.record_linked_movement`:
  a product can now declare that producing/assembling one unit of itself
  consumes units of other products, recorded atomically alongside its own
  stock movement (raw-material-to-finished-good and bundle/composite-product
  cases share this one mechanism). `ProductForm` gained a "Consists of"
  editor; `StockLogForm` lets a vendor override the estimated component
  usage per production run for real-yield variance; `MovementHistory` marks
  ledger rows sharing a `linked_movement_id` as "linked".
- Dashboard `layout.tsx` no longer renders `SiteFooter` — the authenticated
  dashboard never had a footer in qkit's equivalent layout, and stockkit's
  copy was an oversight, not an intentional divergence.
- Fixed: a brand-new vendor with zero products couldn't open "Add product"
  on desktop — `ProductsWorkspace` gated its entire list+detail layout
  (including the form panel) behind `products.length === 0`, so the panel
  never mounted regardless of mode. The empty-state placeholder now lives
  only in the list column (extracted as `EmptyProductsCard`); the detail
  pane renders purely off `mode`/`selected`, as it already did internally.
- Bumped `next` from `^16.2.9` to `^16.2.11`, patching four high-severity
  advisories (SSRF in Server Actions on custom servers, SSRF via
  attacker-controlled rewrite destination hostname) flagged by the CI
  dependency-audit gate.
- `SiteFooter` now renders the full mandatory footer per
  `docs/business/2026-07-21-landing-page-standard.md` §1.5: a `StockKit`
  wordmark (linking `/#top`) and a one-line tagline, alongside the existing
  `© <year> stockkit · a Merqo kit` credit line — it previously carried only
  the credit line, matching qkit's and loopkit's footer structure.
- Logo mark (`BrandText`, public `Navbar`, `DashboardNav`) now renders
  "StockKit" (PascalCase) instead of "stockkit" (fully lowercase), matching
  the locked cross-kit brand-naming convention. Public `Navbar` gained the
  required `#faq` link and its wordmark now uses a plain `<a href="/#top">`
  instead of `next/link`'s `Link`, matching the locked landing-page
  standard. Favicon's brand color updated to match the current (richer)
  primary — it was still the pre-refresh washed-out hex.
- Landing page visual refresh: a new `Space Grotesk` display typeface on
  every section heading, an ambient cobalt-tinted background, a `LedgerCardPreview`
  hero illustration (mock product card — on-hand count, unit cost, a recent
  stock movement), icons and `01/02/03` numbering on `HowItWorks`, icons on
  `Benefits`, a restrained `fade-rise` entrance animation, and a navbar
  restyle (floating pill → full-width sticky translucent bar).

- Landing page decomposed into section components (`Hero`, `HowItWorks`,
  `Benefits`, `Faq`, `Cta`) matching the sibling kits' structure, adding a
  "why vendors pick stockkit" Benefits section stockkit didn't have before.
- Login gained Google OAuth sign-in and a full forgot-password/reset-password
  flow, via a new `/auth/callback` route — none of this existed previously.
- Login and reset-password restyled with a new `ElevatedCard` component.
- Primary color raised from a washed-out `oklch(0.45 0.09 250)` to a
  contrast-verified richer `oklch(0.46 0.16 255)` (light) /
  `oklch(0.68 0.13 252)` (dark); fixed a dead gradient utility that had three
  identical color stops.
- Public `Navbar`/`SiteFooter` made session-aware server components.
