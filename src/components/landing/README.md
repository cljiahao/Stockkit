# src/components/landing

`nav.tsx` (`Nav`) is the public landing nav, wired in by
`src/app/(public)/layout.tsx` (not composed as a page section here). It's
a thin content wrapper over `@merqo/ui`'s `LandingNav` shell — that shared
component owns the sticky/z-index/background/padding shape (fixed a
structural drift vs. qkit/loopkit/paykit/merqo's near-identical landing
navs: `z-50`→`z-20`, `bg-background/80`→`/85`, padding moved from the
inner `<nav>` onto the `<header>`); `Nav` only supplies the two-tone
`StockKit` wordmark (`LandingNav`'s `wordmark` prop) and the FAQ button
plus auth-aware CTA buttons (`end` prop). Matches every other kit's
`src/components/landing/nav.tsx` file/export naming — this used to live at
`src/components/layout/navbar.tsx` exporting `Navbar`, the one structural
outlier across the Merqo kit family, before this migration.

One component per landing-page section (`Hero`, `HowItWorks`, `Benefits`,
`Faq`), composed by `src/app/(public)/page.tsx`. `Hero` takes an `authed`
prop and routes an already-signed-in vendor straight to `/dashboard`
instead of back through `/login`. There is deliberately no bottom
call-to-action band above the footer — removed to match qkit, which never
had one; `SiteFooter` itself (`src/components/layout/`) now matches qkit's
landing footer exactly.

`Hero`'s `<h1>` is the value-prop sentence, not the wordmark — the
`StockKit` name is a small `font-mono uppercase` kicker above it, so it
doesn't just restate the sticky nav's logotype one line below. That
logotype (`BrandText`, from `@/components/widgets`) is otherwise used
as-is everywhere a wordmark appears (`nav.tsx`, `dashboard/dashboard-nav.tsx`)
so the gradient "Stock"/flat "Kit" treatment never renders two different
ways on the same page.

`ledger-card-preview.tsx` is `Hero`'s illustration — a mock product card
(name, stock-status dot, on-hand count, unit cost), not real data, but its
recent-movement row cycles between two sample entries every few seconds
(`prefers-reduced-motion`-gated, reusing the `.fade-rise` keyframe) so the
page's one signature visual reads as a live ledger instead of a frozen
screenshot. `HowItWorks` keeps the shared `ElevatedCard` card-grid
treatment with `01/02/03` numbering, since its three steps are an actual
sequence; `Benefits` is deliberately a different shape — a bordered
horizontal list (icon left, text right, divider rows) — since its three
items have no such order and shouldn't look like they do.

Every `.dom.test.tsx` file here relies on `test/setup.ts`'s global RTL
`cleanup()` instead of declaring its own per-file `afterEach`.

`back-to-top.tsx` is a fixed-position scroll-to-top button (ported verbatim
from qkit), shown past a scroll threshold — wired in as a sibling of
`SiteFooter` in `src/app/(public)/layout.tsx`, not composed as a landing
section here.
