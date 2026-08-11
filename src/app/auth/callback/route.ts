import { NextResponse } from 'next/server';

import { PAGE_ROUTES } from '@/lib/constants/routes';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Where to land after the session is established. Both OAuth sign-in and
  // the password-recovery link route through here; recovery passes
  // ?next=/reset-password. Only accept a same-origin relative path (leading
  // "/", not "//") so the param can't be used as an open redirect.
  const next = searchParams.get('next');
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : PAGE_ROUTES.DASHBOARD;

  if (!code) return NextResponse.redirect(`${origin}${PAGE_ROUTES.LOGIN}?error=oauth`);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}${PAGE_ROUTES.LOGIN}?error=oauth`);

  await ensureVendorRow(supabase);

  return NextResponse.redirect(`${origin}${safeNext}`);
}

/**
 * Google OAuth sign-in lands here without ever running the email/password
 * flow's completeSignup (login/actions.ts) — no local `vendors` row gets
 * created for those vendors otherwise, and every downstream feature that
 * needs one (products' vendor_id FK, plan lookups, and
 * dashboard/tour-actions.ts's markTourSeen) then silently no-ops or fails.
 * markTourSeen's `.update().eq('id', ...)` matches zero rows and returns no
 * error, so the onboarding tour's "seen" stamp never lands and it
 * auto-reruns on every dashboard visit. `ignoreDuplicates` makes this a
 * one-time self-heal per vendor: an existing row (and any stall name a
 * vendor has since set) is left untouched on every later sign-in. Runs for
 * the password-recovery path too — a harmless no-op there, since that
 * vendor's row already exists.
 */
async function ensureVendorRow(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    'Your stall';

  const { error } = await supabase
    .from('vendors')
    .upsert(
      { id: user.id, name: displayName.slice(0, 100) },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (error) console.error('ensureVendorRow failed', error.message);
}
