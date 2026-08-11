# src/app/auth/callback

`GET` Route Handler both Google OAuth and password-recovery links redirect
through. Exchanges the Supabase `code` for a session, then redirects to a
safe same-origin `?next=` path (default `/dashboard`) or to
`/login?error=oauth` on a missing/failed exchange.

On a successful exchange, `ensureVendorRow` also self-heals a local
`stockkit.vendors` row for the signed-in user: the email/password sign-up
flow creates one via `completeSignup` (`(auth)/login/actions.ts`), but
Google OAuth sign-in has no equivalent step, so without this a vendor who
only ever signs in via Google never gets one. That row backs
`dashboard/tour-actions.ts`'s `markTourSeen` (an `UPDATE` with no matching
row silently no-ops, so the onboarding tour re-ran on every dashboard
visit), plan lookups, and `products.vendor_id`'s foreign key. The upsert
uses the OAuth profile's `full_name`/`name` metadata (falling back to a
placeholder) and `ignoreDuplicates: true`, so it's a no-op — never
overwriting an existing stall name — on every later sign-in, including the
password-recovery path this same route also serves.
