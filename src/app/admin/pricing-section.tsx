'use client';

import { PricingForm } from '@merqo/ui';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { PricingConfig } from '@/lib/pricing';
import { setPricing } from './actions';

/**
 * Adapter between this app's own action/toast/refresh plumbing and
 * @merqo/ui's presentational PricingForm. onSave throws (rather than
 * toasting inline) on a failed setPricing call, so the failure routes
 * through PricingForm's own onError exactly once — see this plan's Global
 * Constraints.
 */
export function PricingSection({ initial }: { initial: PricingConfig }) {
  const router = useRouter();

  return (
    <PricingForm
      fields={[{ key: 'monthly_cents', label: `Monthly (${initial.currency})` }]}
      initial={{ values: { monthly_cents: initial.monthly_cents }, currency: initial.currency }}
      onSave={async (values) => {
        const result = await setPricing({ monthly_cents: values.monthly_cents ?? 0 });
        if (!result.success) throw new Error(result.error);
        toast.success('Pricing updated');
        router.refresh();
      }}
      onError={(err) =>
        toast.error(err instanceof Error ? err.message : 'Could not update pricing')
      }
      helpText="Shown on the vendor plan page."
    />
  );
}
