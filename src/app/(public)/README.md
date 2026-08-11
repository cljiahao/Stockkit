# src/app/(public)

The marketing landing page. `page.tsx` composes the section components in
`src/components/landing/` inside a `<div id="top">` (the anchor target for
the nav wordmark's `/#top` link) — no CTA band above the footer,
matching qkit's landing page. `layout.tsx` wraps it with `Nav`
(`src/components/landing/nav.tsx`) and the shared `SiteFooter`, fetches the
session so both can render auth-aware (passing `showSignIn={!authed}` to
`SiteFooter` — hidden once signed in), and renders `BackToTop` as a
fixed-position sibling of `SiteFooter`.
