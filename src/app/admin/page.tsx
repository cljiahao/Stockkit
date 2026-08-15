import { Stat } from '@/app/admin/stat';
import { ElevatedCard } from '@/components/elevated-card';
import { requireAdmin } from '@/lib/admin';
import { currentPricing, platformTotals, recentActivity } from '@/lib/admin-data';
import { cn } from '@/lib/utils';
import { PricingSection } from './pricing-section';

export const revalidate = 0;

const REASON_LABEL: Record<string, string> = {
  restock: 'Restock',
  waste: 'Waste',
  adjustment: 'Adjustment',
  initial: 'Initial balance',
};

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [totals, activity, pricing] = await Promise.all([
    platformTotals(),
    recentActivity(15),
    currentPricing(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Internal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Vendors" value={totals.vendors} />
        <Stat label="Free vendors" value={totals.freeVendors} />
        <Stat label="Pro vendors" value={totals.proVendors} />
        <Stat label="Products" value={totals.products} />
        <Stat label="Active products" value={totals.activeProducts} />
        <Stat label="Stock movements" value={totals.stockMovements} />
      </div>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Recent activity across all vendors
        </h2>
        <ElevatedCard className="p-6">
          <ul className="space-y-2.5">
            {activity.length > 0 ? (
              activity.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{event.product_name ?? '—'}</span>
                      <span className="text-muted-foreground ml-2">{event.vendor_name ?? '—'}</span>
                      <span className="text-muted-foreground ml-2">
                        {REASON_LABEL[event.reason] ?? event.reason}
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        'font-mono text-sm font-semibold tabular-nums',
                        event.delta > 0 ? 'text-stock-ok' : 'text-stock-out'
                      )}
                    >
                      {event.delta > 0 ? '+' : ''}
                      {event.delta}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </span>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground text-sm">No activity yet.</li>
            )}
          </ul>
        </ElevatedCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Pricing
        </h2>
        <PricingSection initial={pricing} />
      </section>
    </main>
  );
}
