import Link from 'next/link';

import { LedgerCardPreview } from '@/components/landing/ledger-card-preview';
import { Button } from '@/components/ui/button';
import { PAGE_ROUTES } from '@/lib/constants/routes';

interface HeroProps {
  authed?: boolean;
}

const TRUST = ['Free to use', 'No setup fee', 'Own your data'];

export function Hero({ authed = false }: HeroProps) {
  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div className="fade-rise text-center lg:text-left">
        <p className="text-primary font-mono text-sm font-semibold tracking-wider uppercase">
          StockKit
        </p>
        <h1 className="font-display mt-3 text-4xl font-bold tracking-tight lg:text-6xl">
          Track stock in and out, and know what every product actually costs you.
        </h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
          <Button asChild size="lg">
            <Link href={authed ? PAGE_ROUTES.DASHBOARD : `${PAGE_ROUTES.LOGIN}?mode=signup`}>
              {authed ? 'Go to dashboard' : 'Get started'}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how">See how it works</a>
          </Button>
        </div>
        <ul className="text-muted-foreground mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm lg:justify-start">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span aria-hidden className="bg-primary/60 size-1.5 rounded-full" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="fade-rise flex justify-center lg:justify-end">
        <LedgerCardPreview />
      </div>
    </div>
  );
}
