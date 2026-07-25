# src/app/(auth)/reset-password

Sets a new password on the recovery session `/auth/callback` establishes
after a vendor clicks a password-reset email link. Three states: checking
the session, no session (link expired/used), ready (new-password form).

The submit handler wraps its `supabase.auth.updateUser` call in
`try/catch` — a thrown rejection still shows a generic toast instead of
failing silently.
