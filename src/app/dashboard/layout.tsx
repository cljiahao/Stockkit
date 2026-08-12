import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardTour } from '@/components/dashboard-tour';
import { SiteFooter } from '@/components/layout';
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
  // to /dashboard before this layout renders.
  if (!user) redirect('/login');

  const { data: vendor } = await supabase
    .from('vendors')
    .select('name, tour_seen_at')
    .eq('id', user.id)
    .maybeSingle();

  // Durable "start" stamp, in addition to dashboard-tour.tsx's client-fired
  // one: this layout wraps every /dashboard/* page, so stamping here —
  // synchronously, as part of this request — lands before the response is
  // even sent, no matter what happens client-side afterwards. See
  // tour-prefs.ts's stampTourSeen and tour-actions.ts's markTourSeen
  // comments for the hard-navigation race this closes.
  if (!vendor?.tour_seen_at) {
    await stampTourSeen(supabase, user.id);
  }

  // The local vendors.name column is a signup-time default only — the
  // shared merqo.vendor_profile row (same source of truth profile/page.tsx
  // reads) wins once it exists. Without this overlay, a vendor whose stall
  // name only lives in the shared table (e.g. it was set from another Merqo
  // kit, or they signed up via Google OAuth — which never creates a local
  // vendors row at all) saw the "Your stall" fallback here forever, even
  // though the profile page showed their real name.
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
      <DashboardTour seen={!!vendor?.tour_seen_at} />
    </div>
  );
}
