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
exactly.

`SiteFooter` is an inverted panel (`bg-foreground`/`text-background`, so it
stays high-contrast against the page in both themes) carrying the three
things §1.5 of the same standard requires: a `StockKit` wordmark (also
`/#top`), a one-line tagline, and the mandatory `© <year> stockkit · a Merqo
kit` credit line. It's shared by the public layout and the dashboard
layout.

`Providers` mounts `<Toaster position="top-right" richColors />` —
`richColors` matches qkit's and loopkit's config so error/success toasts
get their red/green color-coded backgrounds. It doesn't wrap any
client-side data-fetching context (no `QueryClientProvider`) — this app
uses Server Components + Server Actions throughout, per AGENTS.md, so
there's nothing for one to do.

`navbar.dom.test.tsx` relies on `test/setup.ts`'s global RTL `cleanup()`
instead of its own per-file `afterEach`.
