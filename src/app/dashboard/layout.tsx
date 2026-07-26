import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createServerClient } from '@/lib/supabase/server';
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
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav vendorName={vendor?.name ?? 'Your stall'} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
