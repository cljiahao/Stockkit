# src/hooks

Shared React hooks.

- `use-async-action.ts` — `useAsyncAction()` and `navigatingAway()`. Thin
  adapter over `@merqo/ui`'s `useAsyncAction`, which binds one action at
  hook-creation time; this wrapper binds it to "call whatever closure
  you're given" so the hook keeps its original shape
  (`{ pending, run: (fn) => Promise<void> }`, plus additive
  `error`/`reset`), and every real call site (`dashboard-nav.tsx`,
  `profile-form.tsx`, `login-form.tsx`, `reset-password-form.tsx`,
  `product-form.tsx`, `stock-log-form.tsx`, `vendor-plan-toggle.tsx`) needs
  zero changes.
- `index.ts` — re-exports `useAsyncAction`/`navigatingAway`; call sites
  import from `@/hooks`, not the file directly.
