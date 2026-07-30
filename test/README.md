# test

## Purpose

Vitest tests that aren't colocated with their source, plus the global
Vitest setup file.

## Contents

- `api/` — tests for `src/app/api/` and its `withLogging` wrapper:
  `health.test.ts` covers both `GET /api` and `GET /api/health` (the two
  route handlers under `src/app/api/`); `with-logging.test.ts` covers
  `@/lib/utils/with-logging`'s `withLogging` itself (success passthrough,
  thrown-error-to-500 handling, typed dynamic-route `params`), not a route
  handler.
- `setup.ts` — the global Vitest setup file: imports
  `@testing-library/jest-dom/vitest` matchers, polyfills
  `Element.prototype.hasPointerCapture`/`setPointerCapture`/
  `releasePointerCapture`/`scrollIntoView` as no-ops (jsdom doesn't
  implement the Pointer Events capture API — Radix popover-based
  primitives like `Select` call these on open/close/keyboard-nav and throw
  without a stand-in), stubs a no-op `ResizeObserver` (jsdom doesn't
  implement it at all; Radix's `Switch`/`Select` primitives use it to
  measure an anchor element and throw without a stand-in), and runs
  `cleanup()` from `@testing-library/react` after every test, but only
  when a DOM exists (component tests opt into `jsdom` via a `//
@vitest-environment jsdom` docblock; plain node-environment `lib` tests
  would throw if this touched `document` unconditionally).

## Connectivity

`api/` keeps `src/app/api/`'s route-handler tests out of that folder
(`health.test.ts`), and also covers the `withLogging` wrapper those routes
are built on (`with-logging.test.ts`) rather than colocating it next to
`src/lib/utils/with-logging.ts`. `setup.ts` is wired in
as Vitest's global setup (see `vitest.config.ts`'s `test.setupFiles`) and
runs before/after every test file in the project, including `.dom.test.tsx`
files colocated next to the components they test.

## Parent

[stockkit](../README.md)
