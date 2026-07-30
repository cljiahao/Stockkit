'use client';

import { ElevatedCard } from '@/components/elevated-card';
import { Button } from '@/components/ui/button';
import { BrandText } from '@/components/widgets';
import { useEffect } from 'react';

/**
 * Root error boundary — replaces the raw Next error overlay in production if
 * an RSC throws (e.g. Supabase unreachable). Caught here, not global-error.tsx,
 * for anything below the root layout — see global-error.tsx's own comment for
 * the one case this doesn't cover.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <ElevatedCard className="w-full max-w-sm px-7 py-8 text-center">
        <p className="font-display text-xl font-bold tracking-tight">
          <BrandText />
        </p>
        <p className="text-muted-foreground mt-4 text-xs font-semibold tracking-[0.18em] uppercase">
          Something went wrong
        </p>
        <h1 className="mt-1 text-2xl leading-tight font-semibold">That didn&apos;t load</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A hiccup on our end — it&apos;s usually a flaky connection. Try again.
        </p>
        <Button
          onClick={reset}
          size="lg"
          className="mt-6 w-full rounded-xl text-base font-semibold"
        >
          Try again
        </Button>
      </ElevatedCard>
    </div>
  );
}
