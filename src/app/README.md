# src/app

Next.js App Router routes. `(auth)` and `(public)` are route groups (no URL
segment); `dashboard/` requires a session (enforced by `src/proxy.ts`);
`admin/` (own README) is the Merqo-team back-office console, gated by
`requireAdmin()` rather than `proxy.ts` — a signed-out or non-admin request
gets a 404, not a redirect, so the route's existence is never revealed;
`auth/callback/` and `api/` are plain Route Handlers.

`globals.css`'s `@source` includes `node_modules/@merqo/ui/dist` so the
shared package's Tailwind classes get compiled here too.

`layout.tsx` loads three fonts: `Lato` (body), `Geist_Mono` (the "ledger"
numeric signature), and `Space_Grotesk` (`--font-display`, used on landing/
nav headings only). Its `metadata.title` ("Stockkit | Inventory Tracking")
follows every sibling kit's "Name | Tagline" browser-tab shape.

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
