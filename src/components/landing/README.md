# src/components/landing

One component per landing-page section (`Hero`, `HowItWorks`, `Benefits`,
`Faq`), composed by `src/app/(public)/page.tsx`. `Hero` takes an `authed`
prop and routes an already-signed-in vendor straight to `/dashboard`
instead of back through `/login`. There is deliberately no bottom
call-to-action band above the footer — removed to match qkit, which never
had one; `SiteFooter` itself (`src/components/layout/`) now matches qkit's
landing footer exactly.

`ledger-card-preview.tsx` is `Hero`'s illustration — a static mock product
card (name, stock-status dot, on-hand count, unit cost, one recent
movement), not real data. `HowItWorks` and `Benefits` both use lucide icons
and the shared `ElevatedCard` lifted-card treatment; only `HowItWorks` gets
`01/02/03` numbering, since its three steps are an actual sequence and
`Benefits`' three items aren't.

Every `.dom.test.tsx` file here relies on `test/setup.ts`'s global RTL
`cleanup()` instead of declaring its own per-file `afterEach`.

`back-to-top.tsx` is a fixed-position scroll-to-top button (ported verbatim
from qkit), shown past a scroll threshold — wired in as a sibling of
`SiteFooter` in `src/app/(public)/layout.tsx`, not composed as a landing
section here.
