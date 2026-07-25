# src/app

Next.js App Router routes. `(auth)` and `(public)` are route groups (no URL
segment); `dashboard/` requires a session (enforced by `src/proxy.ts`);
`auth/callback/` and `api/` are plain Route Handlers.

`layout.tsx` loads three fonts: `Lato` (body), `Geist_Mono` (the "ledger"
numeric signature), and `Space_Grotesk` (`--font-display`, used on landing/
nav headings only).

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
`.test.ts`/`.test.tsx` for lighter logic-only tests.
