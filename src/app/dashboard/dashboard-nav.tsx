'use client';

import { FeedbackForm } from '@/components/feedback-form';
import { SupportForm } from '@/components/support-form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { navigatingAway, useAsyncAction } from '@/hooks';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { LifeBuoy, LogOut, Menu, MessageSquarePlus, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  vendorName: string;
  avatarUrl?: string | null;
}

const LINKS = [
  { href: PAGE_ROUTES.DASHBOARD, label: 'Overview' },
  { href: PAGE_ROUTES.PRODUCTS, label: 'Products' },
];

function isActive(path: string, href: string): boolean {
  return href === PAGE_ROUTES.DASHBOARD ? path === PAGE_ROUTES.DASHBOARD : path.startsWith(href);
}

function initials(label: string): string {
  const first = label.trim().charAt(0);
  return first ? first.toUpperCase() : '•';
}

/**
 * Dashboard sticky-header row, per docs/business/2026-07-21-dashboard-nav-standard.md:
 * burger far-left (below sm — opens a mobile panel of the same page links
 * shown inline at sm+), avatar/account dropdown far-right at every width.
 * Content is width-constrained to max-w-site, matching every dashboard
 * page's own container, so the nav's edges line up with the page content
 * beneath it instead of stretching to the full viewport. No Plan item —
 * stockkit has no vendor-tier concept (sanctioned skip, see this plan's
 * Global Constraints).
 */
export function DashboardNav({ vendorName, avatarUrl = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { pending, run } = useAsyncAction();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function onSignOut() {
    return run(async () => {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
      await navigatingAway();
    });
  }

  return (
    <>
      <nav className="border-border bg-card sticky top-0 z-50 w-full border-b">
        <div className="max-w-site flex-between mx-auto min-h-16 px-3 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className="text-muted-foreground hover:bg-secondary -ml-1.5 shrink-0 rounded-lg p-1.5 sm:hidden"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link
              href={PAGE_ROUTES.DASHBOARD}
              className="shrink-0 text-xl font-bold tracking-tight"
            >
              <span className="text-primary">Stock</span>
              <span>Kit</span>
            </Link>

            <div className="hidden items-center gap-1 sm:flex">
              {LINKS.map((l) => (
                <Button
                  key={l.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'rounded-lg',
                    isActive(pathname, l.href) && 'bg-primary/10 text-primary'
                  )}
                >
                  <Link href={l.href}>{l.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="hover:bg-secondary focus-visible:ring-ring/50 flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left transition-colors outline-none focus-visible:ring-[3px]"
              >
                <Avatar className="ring-primary/25 size-8 shrink-0 rounded-md ring-1 ring-inset">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback className="bg-primary/12 text-primary rounded-md font-mono text-xs font-semibold tracking-tight">
                    {initials(vendorName)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
                  {vendorName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="px-2 py-2">
                <p className="truncate text-sm font-semibold">{vendorName}</p>
                <p className="text-muted-foreground text-xs font-normal">Vendor account</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="cursor-pointer">
                  <User className="size-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setHelpOpen(true)}>
                <LifeBuoy className="size-4" />
                Get help
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setFeedbackOpen(true)}>
                <MessageSquarePlus className="size-4" />
                Feedback
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer"
                onSelect={onSignOut}
                disabled={pending}
              >
                <LogOut className="size-4" />
                {pending ? 'Signing out…' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {mobileOpen && (
          <div className="border-border bg-background border-t px-3 py-3 sm:hidden">
            <div className="flex flex-col gap-1">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm font-semibold',
                    isActive(pathname, l.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary'
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <Sheet open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-2xl">Share feedback</SheetTitle>
            <SheetDescription>
              What&apos;s working, what&apos;s missing, what&apos;s broken?
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <FeedbackForm />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-2xl">Get help</SheetTitle>
            <SheetDescription>
              Trouble with products, stock, or your account? Tell us and we&apos;ll sort it out.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <SupportForm />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
