# test

## Purpose

Vitest tests that aren't colocated with their source, plus the global
Vitest setup file.

## Contents

- `api/` — route-handler tests, one file per route, mirroring
  `src/app/api/`'s structure one-for-one.
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

`api/` mirrors `src/app/api/`'s structure one-for-one so each route
handler has a corresponding test file here rather than living next to the
route (keeping `src/app/api/` free of test files). `setup.ts` is wired in
as Vitest's global setup (see `vitest.config.ts`'s `test.setupFiles`) and
runs before/after every test file in the project, including `.dom.test.tsx`
files colocated next to the components they test.

## Parent

[stockkit](../README.md)
