# src/app/(auth)/login

Combined sign-in/sign-up page. `page.tsx` is a thin `Suspense` wrapper;
`login-form.tsx` holds the actual client component (email/password,
Google OAuth, forgot-password). `actions.ts` has `completeSignup`, the
server action that creates the `vendors` row after a new signup.
`google-mark.tsx` holds `GoogleMark`, the Google "G" icon SVG, extracted
out of `login-form.tsx` so it matches the shared component used across
every kit's login page.

Every async handler in `login-form.tsx` (Google sign-in, sign-in/up,
password-reset send) wraps its Supabase call in `try/catch` — a thrown
rejection (e.g. a raw network failure, not a returned `{ error }`) still
shows a generic toast instead of failing silently.

`login-form.dom.test.tsx` relies on `test/setup.ts`'s global RTL
`cleanup()` rather than its own per-file `afterEach`.
