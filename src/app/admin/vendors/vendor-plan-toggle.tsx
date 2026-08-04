'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { setVendorPlan } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/hooks/use-async-action';
import type { Tier } from '@/lib/plan';

/** Per-row Make Pro / Make Free control — no modal, immediate write + toast. */
export function VendorPlanToggle({
  vendorId,
  vendorName,
  plan,
}: {
  vendorId: string;
  vendorName: string;
  plan: Tier;
}) {
  const router = useRouter();
  const { pending, run } = useAsyncAction();
  const nextPlan: Tier = plan === 'pro' ? 'free' : 'pro';

  function toggle() {
    run(async () => {
      const fd = new FormData();
      fd.set('vendorId', vendorId);
      fd.set('plan', nextPlan);
      const result = await setVendorPlan(fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        nextPlan === 'pro' ? `${vendorName} is now Pro.` : `${vendorName} is back on Free.`
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={plan === 'pro' ? 'outline' : 'default'}
      size="sm"
      disabled={pending}
      onClick={toggle}
      className="rounded-xl"
    >
      {pending ? 'Saving…' : plan === 'pro' ? 'Make Free' : 'Make Pro'}
    </Button>
  );
}
