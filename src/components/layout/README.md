# src/components/layout

Site chrome shared across routes: `SiteFooter` (public marketing footer —
the dashboard has its own `DashboardNav` from `@merqo/ui`, and the public
nav lives in `src/components/landing/nav.tsx`, not here), plus
`Providers`/`ThemeProvider`.

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
