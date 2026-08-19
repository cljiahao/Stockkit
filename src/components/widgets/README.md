# src/components/widgets

Small app-wide bits used by more than one feature area: `BrandText` (the
"StockKit" logo-mark spans, PascalCase per
`docs/business/2026-07-15-kit-brand-naming-convention.md`), `BrandLogo`,
`LinkList`. No kit-local theme toggle lives here anymore — light/dark/system
switching is now a shared control inside `@merqo/ui`'s `AccountMenu`
(v0.18.0+), reachable from the signed-in dashboard.
