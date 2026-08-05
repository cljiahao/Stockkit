# supabase

## Purpose

The Supabase client factories (browser, server) and the session-refresh
middleware helper that `src/proxy.ts` calls on every request.

## Contents

- `client.ts` — `createClient()`: browser Supabase client
  (`createBrowserClient` from `@supabase/ssr`).
- `server.ts` — `createServerClient()`/`createServiceClient()`: server-side
  clients for Server Components, Server Actions, and route handlers; the
  service-role client bypasses RLS.
- `env.ts` — fail-fast validation of `NEXT_PUBLIC_SUPABASE_*` env vars.
- `middleware.ts` — `updateSession()`: refreshes the Supabase session cookie
  and redirects unauthenticated requests. `isProtectedPath()` matches both
  `/dashboard` and `/admin` — a request outside either path skips the
  refresh entirely (public pages, static assets).
- `middleware.test.ts` — covers public paths, `/dashboard`, `/admin`
  (including nested paths), and the auth-unreachable degrade-to-redirect case.
