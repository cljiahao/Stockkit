# src/app/dashboard

The authenticated vendor dashboard (guarded by `src/proxy.ts`). `layout.tsx`
resolves the session + stall name and renders `dashboard-nav.tsx` (burger
far-left below `sm`, avatar/account dropdown far-right at every width, per
`docs/business/2026-07-21-dashboard-nav-standard.md`). No footer here —
unlike the public site, the authenticated dashboard never renders
`SiteFooter`, matching qkit's dashboard layout. `(overview)/` is the
stock-value/low/out-of-stock stats page; `products/` is the products
workspace (own README); `profile/` is the account-settings page.
