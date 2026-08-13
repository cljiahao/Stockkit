import { LandingNav } from '@merqo/ui';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { BrandText, ThemeToggleButton } from '@/components/widgets';
import { PAGE_ROUTES } from '@/lib/constants/routes';

interface NavProps {
  authed?: boolean;
}

// Public-marketing nav only — the dashboard uses its own DashboardNav
// (vendor name + sign out), never this one, so this stays a plain server
// component: logo plus one auth-aware primary action, no client JS needed.
// The sticky/z-index/background/padding shape lives in @merqo/ui's
// LandingNav shell (shared across all Merqo kits); this file only supplies
// stockkit's wordmark and right-side content.
export function Nav({ authed = false }: NavProps) {
  return (
    <LandingNav
      wordmark={
        // Plain <a>, not next/link's Link: this is a same-page hash jump to
        // #top, and Link doesn't reliably update the URL bar's hash when
        // only the fragment changes — it scrolls but leaves the old hash
        // showing. A native anchor always gets this right.
        // eslint-disable-next-line @next/next/no-html-link-for-pages
        <a
          href="/#top"
          className="font-display text-3xl font-semibold tracking-tight transition-opacity hover:opacity-80"
        >
          <BrandText />
        </a>
      }
      end={
        <>
          <Button asChild variant="ghost" size="sm" className="hidden rounded-lg sm:inline-flex">
            <a href="#faq">FAQ</a>
          </Button>
          {authed ? (
            <Button asChild className="h-10 rounded-lg px-5 font-semibold">
              <Link href={PAGE_ROUTES.DASHBOARD}>Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="h-10 rounded-lg px-4">
                <Link href={PAGE_ROUTES.LOGIN}>Sign in</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold">
                <Link href={`${PAGE_ROUTES.LOGIN}?mode=signup`}>Get started</Link>
              </Button>
            </>
          )}
          <ThemeToggleButton />
        </>
      }
    />
  );
}
