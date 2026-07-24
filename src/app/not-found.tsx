import { ElevatedCard } from '@/components/elevated-card';
import { Button } from '@/components/ui/button';
import { BrandText } from '@/components/widgets';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import Link from 'next/link';

/** Branded 404 — reached e.g. when a vendor opens a stale or mistyped link. */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <ElevatedCard className="w-full max-w-sm px-7 py-8 text-center">
        <p className="font-display text-xl font-bold tracking-tight">
          <BrandText />
        </p>
        <p className="text-primary mt-4 font-mono text-4xl font-bold">404</p>
        <h1 className="mt-1 text-2xl leading-tight font-semibold">Not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          This page doesn&apos;t exist. Check the link, or head back to the start.
        </p>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="mt-6 w-full rounded-xl text-base font-semibold"
        >
          <Link href={PAGE_ROUTES.HOME}>Back to start</Link>
        </Button>
      </ElevatedCard>
    </div>
  );
}
