import { LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';

import { AdminNav } from '@/app/admin/admin-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandText } from '@/components/widgets';
import { requireAdmin } from '@/lib/admin';
import { createServerClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Gate every /admin route: non-admins get a 404 from requireAdmin.
  await requireAdmin();

  async function signOut() {
    'use server';
    const supabase = await createServerClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border bg-background/85 sticky top-0 z-20 border-b px-5 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="font-display text-xl font-bold tracking-tight">
              <BrandText />
            </p>
            <Badge variant="secondary" className="tracking-wider uppercase">
              Admin
            </Badge>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-muted-foreground rounded-lg"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
        </div>
        <AdminNav />
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
