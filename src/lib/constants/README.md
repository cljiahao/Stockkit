# src/lib/constants

App-wide route and API-path constants (`PAGE_ROUTES`, `API_ROUTES`) so
route strings live in one place instead of being hand-typed at each
call site. `env.ts` — `API_BASE` (`NEXT_PUBLIC_BASE_URL`, falling back to
`http://localhost:3000`) and the `isDev`/`isProd` `NODE_ENV` flags.
`index.ts` re-exports both modules.
