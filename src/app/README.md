# src/app

Next.js App Router routes. `(auth)` and `(public)` are route groups (no URL
segment); `dashboard/` requires a session (enforced by `src/proxy.ts`);
`admin/` (own README) is the Merqo-team back-office console, gated by
`requireAdmin()` rather than `proxy.ts` — a signed-out or non-admin request
gets a 404, not a redirect, so the route's existence is never revealed;
`auth/callback/` and `api/` are plain Route Handlers.

`globals.css`'s `@source` includes `node_modules/@merqo/ui/dist` so the
shared package's Tailwind classes get compiled here too. Its color tokens
are named "Reefer Frost" in the file's own header comment (chilled
cyan-teal primary, frost-grey paper, crate-stamp crimson on
destructive/attention actions) — the founder-approved cross-kit brand
pick as of 2026-08-19. It also defines `.tour-example`/`.tour-example-row`/
`.tour-example-pill`/`.tour-example-label`, the shared styling for the
small HTML preview embedded in the dashboard tour's first step (see
`src/components/README.md`'s `dashboard-tour.tsx` entry). `--card`/`--popover` were fixed to differ from `--background` in light mode after the Reefer Frost rebrand had accidentally collapsed them to the same value; dark mode was already correct.

`layout.tsx` loads three fonts: `Lato` (body), `Geist_Mono` (the "ledger"
numeric signature), and `Fraunces` (`--font-display`, the family-wide shared
serif face — see `docs/business/2026-08-13-typography-family-standard.md`),
used on every wordmark plus the marketing hero's `<h1>`; dashboard/admin page
headings stay on the plain body sans, a deliberate Persuade/Operate split.
Its `metadata.title` ("Stockkit | Inventory Tracking") follows every sibling
kit's "Name | Tagline" browser-tab shape.

`layout.tsx` also wraps the app in next-themes' `ThemeProvider`
(`defaultTheme="system"` + `enableSystem`), so the `.dark` palette in
`globals.css` applies from the OS/browser preference on first visit; the
manual override now lives in `@merqo/ui`'s `AccountMenu` (v0.18.0+,
signed-in only — theme switching is a signed-in preference, not a
public-nav control), persisted to localStorage and shared across every
route under this one provider.

`error.tsx` (nested-error boundary — anything below the root layout that
throws) and `not-found.tsx` (custom 404) are branded `ElevatedCard`s
matching the rest of the app; `global-error.tsx` catches the one case
those can't — the root layout itself throwing — so it ships its own
`<html>`/`<body>` with inline styles hand-converted from `globals.css`'s
light-mode tokens, since it can't rely on the stylesheet having loaded.
Matches qkit's and loopkit's three-file pattern. Their tests
(`error.dom.test.tsx`, `not-found.dom.test.tsx`, `global-error.dom.test.tsx`)
use the `.dom.test.tsx` suffix — stockkit's (and qkit's documented)
convention for full RTL+jsdom component-render tests, as opposed to plain
`.test.ts`/`.test.tsx` for lighter logic-only tests. They (and every other
`.dom.test.tsx` file) rely on `test/setup.ts`'s global RTL `cleanup()` and
jest-dom matchers instead of declaring their own per-file `afterEach`.
