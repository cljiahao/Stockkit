# src/components/layout

Site chrome shared across routes: `Navbar` and `SiteFooter` (public
marketing nav/footer — the dashboard has its own `DashboardNav`, never
these), plus `Providers`/`ThemeProvider`.

`Navbar` is a full-width sticky translucent bar (`sticky top-0 border-b
bg-background/80 backdrop-blur`), not a floating pill — chosen to sit
cleanly on top of the landing page's ambient gradient background. Per
`docs/business/2026-07-21-landing-page-standard.md`: wordmark links via a
plain `<a href="/#top">` (not `next/link`'s `Link`, for reliable same-page
hash navigation) and there's a `#faq` link next to the login/dashboard CTA.
Padding/logo size (`px-5 py-4`, `text-3xl`) matches qkit's landing nav
exactly. The "Get started" CTA uses the shared `size="sm"` Button token
(was a custom className) for cross-kit CTA-size parity.

`SiteFooter` is a single-row, bordered footer (`border-t`, transparent
background) matching qkit's landing footer exactly — a `StockKit` wordmark
(also `/#top`), a one-line tagline, the mandatory `© <year> stockkit · a
Merqo kit` credit line, and (via the `showSignIn` prop, on for the public
layout only) a `Vendor sign in →` link. It's shared by the public layout
and the dashboard layout — `showSignIn` stays off for the dashboard call
since a signed-in vendor there is, by definition, already signed in.

`Providers` mounts `<Toaster position="top-right" richColors />` —
`richColors` matches qkit's and loopkit's config so error/success toasts
get their red/green color-coded backgrounds. It doesn't wrap any
client-side data-fetching context (no `QueryClientProvider`) — this app
uses Server Components + Server Actions throughout, per AGENTS.md, so
there's nothing for one to do.

`navbar.dom.test.tsx` relies on `test/setup.ts`'s global RTL `cleanup()`
instead of its own per-file `afterEach`.
