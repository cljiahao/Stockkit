'use client';

import { DashboardNav as SharedDashboardNav, getSwitchKits } from '@merqo/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { submitFeedbackAction } from '@/app/actions/feedback';
import { submitSupportMessageAction } from '@/app/actions/support';
import { BrandText } from '@/components/widgets';
import { navigatingAway } from '@/hooks';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { SUPPORT_CATEGORY_LABELS, type SupportMessageInput } from '@/lib/schemas';
import { createClient } from '@/lib/supabase/client';

interface Props {
  vendorName: string;
  avatarUrl?: string | null;
}

const NAV_LINKS = [
  { href: PAGE_ROUTES.DASHBOARD, label: 'Overview' },
  { href: PAGE_ROUTES.PRODUCTS, label: 'Products' },
];

function isActive(path: string, href: string): boolean {
  return href === PAGE_ROUTES.DASHBOARD ? path === PAGE_ROUTES.DASHBOARD : path.startsWith(href);
}

/** Stable anchor id for the onboarding tour, e.g. "/dashboard/products" → "nav-products". */
function tourAnchor(href: string): string {
  return `nav-${href === PAGE_ROUTES.DASHBOARD ? 'overview' : href.split('/').pop()}`;
}

const SUPPORT_CATEGORIES = (
  Object.keys(SUPPORT_CATEGORY_LABELS) as SupportMessageInput['category'][]
).map((value) => ({ value, label: SUPPORT_CATEGORY_LABELS[value] }));

/** Narrows the Get-help form's freeform category string to a real support
 *  category — the categories list above is the only source of values the
 *  form can ever produce, so anything else means no category was picked. */
function isSupportCategory(value: string | undefined): value is SupportMessageInput['category'] {
  return !!value && Object.hasOwn(SUPPORT_CATEGORY_LABELS, value);
}

const WORDMARK = (
  <Link
    href={PAGE_ROUTES.DASHBOARD}
    className="font-display shrink-0 text-3xl font-semibold tracking-tight transition-opacity hover:opacity-80"
  >
    <BrandText />
  </Link>
);

/**
 * Dashboard nav content — thin adapter composing `@merqo/ui`'s `DashboardNav`
 * (which renders its own sticky `<header>`; the wrapping element in
 * `layout.tsx` must stay `display: contents` so that header's `position:
 * sticky` isn't broken by a nested containing block) with stockkit-specific
 * wiring: sign-out, and adapters for Feedback/Get-help, since
 * `submitFeedbackAction`/`submitSupportMessageAction` return
 * `{success, error}` result objects rather than throwing, but
 * `AccountMenu`'s `onSubmit` contracts require a rejected promise on
 * failure.
 */
export function DashboardNav({ vendorName, avatarUrl = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function signOutAction() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    router.push('/login');
    router.refresh();
    await navigatingAway();
  }

  return (
    <SharedDashboardNav
      wordmark={WORDMARK}
      navLinks={NAV_LINKS}
      isActiveHref={(href) => isActive(pathname, href)}
      tourAnchor={tourAnchor}
      vendor={{ name: vendorName, avatarUrl: avatarUrl ?? undefined, subtitle: vendorName }}
      signOutAction={signOutAction}
      switchKits={getSwitchKits('stockkit')}
      getHelp={{
        type: 'form',
        onSubmit: async ({ message, category }) => {
          const res = await submitSupportMessageAction({
            category: isSupportCategory(category) ? category : 'other',
            body: message,
          });
          if (!res.success) throw new Error(res.error);
        },
        categories: SUPPORT_CATEGORIES,
      }}
      onFeedbackSubmit={async ({ message, nps }) => {
        const res = await submitFeedbackAction({ nps: nps ?? 0, message });
        if (!res.success) throw new Error(res.error);
      }}
      showNps
    />
  );
}
