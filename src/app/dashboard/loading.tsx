import { Loader2 } from 'lucide-react';

// Next wraps this segment's page (and every nested page below it — overview,
// products, profile) in a Suspense boundary keyed to this file — the layout's
// nav renders immediately, and this only shows if the incoming page takes a
// moment (slow query, cold Turbopack compile), instead of the content area
// sitting blank mid-transition. Every dashboard page sets `revalidate = 0`
// (always dynamic, never prerendered), so this applies on every navigation.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
    </div>
  );
}
