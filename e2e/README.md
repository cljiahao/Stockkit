# e2e

## Purpose

Playwright end-to-end smoke tests. They need only `pnpm dev` and
`playwright install`, with dummy Supabase values and no live database.

## Contents

- `smoke.spec.ts` — public smoke: the landing page renders its "Track stock
  in and out" hero heading, and `/login` renders its "Continue with Google"
  button.
- `auth-guard.spec.ts` — signed-out route protection: `/dashboard`,
  `/dashboard/products` and `/admin` redirect to `/login`. `src/proxy.ts`
  resolves `user: null` locally when there is no session cookie, so the
  redirect fires without a database.

## Connectivity

Run by `pnpm test:e2e` (`playwright.config.ts`, which starts `pnpm dev`) and
by the `e2e (public smoke)` job in `.github/workflows/ci.yml`. Vitest does
not pick these files up: its `include` covers `test/` and `src/` only.

## Parent

[stockkit](../README.md)
