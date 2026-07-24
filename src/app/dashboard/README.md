# src/app/dashboard

The authenticated vendor dashboard (guarded by `src/proxy.ts`). `layout.tsx`
resolves the session + stall name + avatar URL (read defensively off
`user.user_metadata`) and renders `dashboard-nav.tsx`: burger far-left
below `sm` (opens the same Overview/Products links shown inline at `sm`+),
avatar/account dropdown far-right at every width, per
`docs/business/2026-07-21-dashboard-nav-standard.md` — the account
dropdown's avatar renders the vendor's uploaded profile icon when set,
falling back to initials otherwise. The nav's content is wrapped in
`max-w-site mx-auto`, matching every dashboard page's own container, so its
edges line up with the page content beneath it instead of stretching to
the full viewport width. `(overview)/` is the stock-value/low/
out-of-stock stats page; `products/` is the products workspace; `profile/`
is the account-settings page.

`profile-form.tsx`'s stall-name and avatar saves call `router.refresh()`
on success — both are displayed by `dashboard-nav.tsx`, which is rendered
once by the persistent layout, so without an explicit refresh it would
keep showing stale data until a hard reload even though the underlying
write succeeded.
