import { BackButton } from '@/components/back-button';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { ENTITLEMENTS, normalizePlan } from '@/lib/plan';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UpgradeCta } from './upgrade-cta';

export const revalidate = 0;

const PRO_PRICE = '$14/mo';

export default async function PlanPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defense in depth — proxy.ts already redirects unauthenticated requests
  // to /login before this page renders.
  if (!user) redirect('/login');

  const { data: vendorRow } = await supabase
    .from('vendors')
    .select('plan')
    .eq('id', user.id)
    .single();
  const plan = normalizePlan(vendorRow?.plan);
  const entitlement = ENTITLEMENTS[plan];

  return (
    <div className="max-w-site mx-auto w-full space-y-6 px-6 py-8">
      <BackButton href={PAGE_ROUTES.DASHBOARD} label="Dashboard" />
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Your account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
      </header>

      <div className="border-border rounded-xl border p-4">
        <p className="text-sm font-medium">
          Current plan: <span className="capitalize">{plan}</span>
        </p>
      </div>

      <div className="border-border rounded-xl border p-4">
        <p className="text-sm font-medium">{plan === 'pro' ? 'Pro' : 'Free'}</p>
        <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
          <li>
            {entitlement.maxActiveProducts === null
              ? 'Unlimited products'
              : `Up to ${entitlement.maxActiveProducts} active products`}
          </li>
          <li>
            {entitlement.movementHistoryLimit === null
              ? 'Full stock movement history'
              : `Last ${entitlement.movementHistoryLimit} stock movements per product`}
          </li>
          {entitlement.csvExport && <li>CSV export</li>}
          {plan === 'pro' && <li>Valuation trend reports (coming soon)</li>}
        </ul>
        {plan === 'free' && (
          <div className="mt-3">
            <p className="text-muted-foreground text-sm">
              Ask us to upgrade your account to Pro for unlimited products, full history, and CSV
              export, <span className="font-mono">{PRO_PRICE}</span>.
            </p>
            <UpgradeCta />
          </div>
        )}
      </div>
    </div>
  );
}
