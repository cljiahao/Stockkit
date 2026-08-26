'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PAGE_ROUTES } from '@/lib/constants/routes';
import { cn } from '@/lib/utils';

const TABS = [
  { href: PAGE_ROUTES.ADMIN, label: 'Overview' },
  { href: PAGE_ROUTES.ADMIN_VENDORS, label: 'Vendors' },
  { href: PAGE_ROUTES.ADMIN_ACTIVITY, label: 'Activity' },
];

/** Admin section tabs. Overview matches exactly; Vendors matches by prefix. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-5 pt-3 pb-1">
      {TABS.map((t) => {
        const active =
          t.href === PAGE_ROUTES.ADMIN ? path === PAGE_ROUTES.ADMIN : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
