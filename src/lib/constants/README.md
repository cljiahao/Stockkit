# src/lib/constants

App-wide route and API-path constants (`PAGE_ROUTES`, `API_ROUTES`) so
route strings live in one place instead of being hand-typed at each
call site. `PAGE_ROUTES.PLAN` (`/dashboard/plan`) backs the Free/Pro plan
page and the account menu's "Plan" nav item. `PAGE_ROUTES.ADMIN`/`ADMIN_VENDORS`
(`/admin`, `/admin/vendors`) back the Merqo-team admin console's nav tabs
and its Server Actions' `revalidatePath` calls. `env.ts` — `API_BASE` (`NEXT_PUBLIC_BASE_URL`, falling back to
`http://localhost:3000`) and the `isDev`/`isProd` `NODE_ENV` flags.
`index.ts` re-exports both modules.
