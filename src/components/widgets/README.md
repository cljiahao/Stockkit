# src/components/widgets

Small app-wide bits used by more than one feature area: `BrandText` (the
"StockKit" logo-mark spans, PascalCase per
`docs/business/2026-07-15-kit-brand-naming-convention.md`), `BrandLogo`,
`LinkList`, `ThemeToggleButton` (light/dark override, wired into
`src/components/landing/nav.tsx`'s `end` slot — the only reachable spot for
it, since `DashboardNav` is a `@merqo/ui` shared shell with no free slot;
its choice persists via next-themes' localStorage to every route anyway).
