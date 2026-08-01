# src/components/landing

One component per landing-page section (`Hero`, `HowItWorks`, `Benefits`,
`Faq`, `Cta`), composed by `src/app/(public)/page.tsx`. `Hero` and `Cta`
take an `authed` prop and route an already-signed-in vendor straight to
`/dashboard` instead of back through `/login`.

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
