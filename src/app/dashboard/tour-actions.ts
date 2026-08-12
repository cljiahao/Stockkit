'use server';

import { createServerClient } from '@/lib/supabase/server';
import { stampTourSeen } from '@/lib/tour-prefs';

/**
 * Client-fired mark-seen: wired as `onFirstSeen` on `@merqo/ui`'s
 * `DashboardTour` (dashboard-tour.tsx), fired the moment the tour auto-
 * starts. Fire-and-forget from the client, so it never blocks the tour
 * itself — but that also means a hard navigation away from the page (e.g.
 * clicking a real dashboard nav link the tour's own steps spotlight —
 * `@merqo/ui`'s `DashboardNav` renders nav links as plain `<a>` tags, not
 * `next/link`, so that's a full page reload) can abort this write before it
 * lands. `DashboardLayout`'s own synchronous stamp (`stampTourSeen`, called
 * directly from `layout.tsx`'s server render) is what actually guarantees
 * the write survives that; this one is just the fast common-case duplicate
 * (the update is idempotent either way).
 */
export async function markTourSeen(): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await stampTourSeen(supabase, user.id);
}
