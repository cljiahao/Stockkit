import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PAGE_ROUTES } from '@/lib/constants/routes';
import { formatPrice } from '@/lib/schemas';
import { STOCK_STATUS_DOT_CLASS, stockStatusFor } from '@/lib/stock';
import { createServerClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// Vendor data changes on every stock movement — never statically prerender.
export const revalidate = 0;

export default async function DashboardOverviewPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('products').select('*').eq('is_active', true).order('name');
  const products = data ?? [];

  if (products.length === 0) {
    return (
      <div className="py-12">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Card className="mt-8" data-tour="inventory-value">
          <CardHeader>
            <CardTitle>Add your first product</CardTitle>
            <CardDescription>
              Once you add a product, you&apos;ll see its stock value and low-stock alerts here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={PAGE_ROUTES.PRODUCTS}>Add a product</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalValueCents = products.reduce((sum, p) => sum + p.on_hand * p.unit_cost_cents, 0);
  const lowStock = products.filter((p) => p.on_hand > 0 && p.on_hand <= p.low_stock_threshold);
  const outOfStock = products.filter((p) => p.on_hand <= 0);
  const urgent = [...outOfStock, ...lowStock].slice(0, 5);

  return (
    <div className="py-12">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-2">An overview of your stock.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card data-tour="inventory-value">
          <CardHeader>
            <CardDescription>Inventory value</CardDescription>
            <CardTitle className="font-mono text-3xl tabular-nums">
              {formatPrice(totalValueCents)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Low stock</CardDescription>
            <CardTitle className="text-stock-low font-mono text-3xl tabular-nums">
              {lowStock.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Out of stock</CardDescription>
            <CardTitle className="text-stock-out font-mono text-3xl tabular-nums">
              {outOfStock.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {urgent.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>Your most urgent low or out-of-stock products.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {urgent.map((p) => {
              const status = stockStatusFor(p.on_hand, p.low_stock_threshold);
              return (
                <div
                  key={p.id}
                  className="border-border flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-muted-foreground text-xs">
                      Threshold:{' '}
                      <span className="font-mono tabular-nums">{p.low_stock_threshold}</span>{' '}
                      {p.unit}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={cn('size-2 rounded-full', STOCK_STATUS_DOT_CLASS[status])} />
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {p.on_hand} {p.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link href={PAGE_ROUTES.PRODUCTS}>View all products</Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
