import type { ReactNode } from 'react';

import { BackToTop } from '@/components/landing/back-to-top';
import { Navbar, SiteFooter } from '@/components/layout';
import { PAGE_ROUTES } from '@/lib/constants/routes';
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
      <Navbar authed={authed} />
      <main className="flex flex-1 flex-col">{children}</main>
      <SiteFooter links={authed ? [] : [{ label: 'Vendor sign in →', href: PAGE_ROUTES.LOGIN }]} />
      <BackToTop />
    </div>
  );
}
