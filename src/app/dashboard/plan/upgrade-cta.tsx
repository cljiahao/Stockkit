'use client';

import { requestProUpgradeAction } from '@/app/actions/plan';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/**
 * Interest CTA for the Pro plan. Files an in-product request (no payment
 * provider — stockkit has no self-serve billing yet); Pro is granted
 * manually. Mirrors paykit's identical UpgradeCta pattern.
 */
export function UpgradeCta() {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const res = await requestProUpgradeAction();
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Request sent. We'll set you up shortly.");
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={onClick} className="mt-3 rounded-lg">
      {pending ? 'Sending…' : 'Ask us to upgrade to Pro'}
    </Button>
  );
}
