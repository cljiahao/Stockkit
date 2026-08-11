import type { ReactNode } from 'react';

import { BackToTop } from '@/components/landing/back-to-top';
import { Nav } from '@/components/landing/nav';
import { SiteFooter } from '@/components/layout';
import { createServerClient } from '@/lib/supabase/server';

export const revalidate = 0;

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav authed={authed} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter showSignIn={!authed} />
      <BackToTop />
    </div>
  );
}
