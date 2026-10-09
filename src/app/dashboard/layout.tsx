import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardTourServer } from '@/components/dashboard-tour.server';
import { SiteFooter } from '@/components/layout';
import { requireCurrentLegalAcceptance } from '@/lib/legal-gate';
import { createServerClient } from '@/lib/supabase/server';
import { stampTourSeen } from '@/lib/tour-prefs';
import { resolveVendorName } from '@/lib/vendor-name';
import { DashboardNav } from './dashboard-nav';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense in depth — proxy.ts already redirects unauthenticated requests
  // to /login before this layout renders.
  if (!user) redirect('/login');

  // A vendor whose accepted terms/privacy versions are stale is bounced to
  // the /legal/accept interstitial — stockkit has no shared vendor-gate
  // helper (unlike qkit/loopkit/paykit), so this is the one real entry point
  // every /dashboard/* page renders through.
  await requireCurrentLegalAcceptance(user.email);

  const { data: vendor } = await supabase
    .from('vendors')
    .select('name, tour_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  // Stamp before sending the response so a hard navigation cannot lose it.
  if (!vendor?.tour_seen_at) {
    await stampTourSeen(supabase, user.id);
  }

  // Shared vendor profile data takes precedence over the signup-time local name.
  const vendorName = await resolveVendorName(supabase, user.id, vendor?.name ?? null);

  // avatar_url is arbitrary JSON on the auth user — read defensively, per
  // the profile settings standard's §3.1 (kit-local, never the shared table).
  const rawAvatarUrl = user.user_metadata?.avatar_url;
  const avatarUrl = typeof rawAvatarUrl === 'string' ? rawAvatarUrl : null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* @merqo/ui's DashboardNav renders its own sticky <header> internally
          — this wrapper MUST stay `display: contents` (a plain box-generating
          element here would give the nested header no room in its containing
          block to shift, breaking `position: sticky`). */}
      <div className="contents print:hidden">
        <DashboardNav vendorName={vendorName} avatarUrl={avatarUrl} />
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6">{children}</main>
      <SiteFooter />
      <DashboardTourServer seen={!!vendor?.tour_seen_at} />
    </div>
  );
}
