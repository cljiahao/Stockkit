import { type NextRequest, NextResponse } from 'next/server';

import { bearerOk } from '@/lib/merqo-auth';
import { computeStockkitMetrics } from '@/lib/metrics';
import { createServiceClient } from '@/lib/supabase/server';
import type { StockMovementReason, VendorPlan } from '@/lib/types';
import { withLogging } from '@/lib/utils/with-logging';

export const revalidate = 0;

export const GET = withLogging(async (request: NextRequest): Promise<NextResponse> => {
  if (!bearerOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Three independent reads — issue them concurrently so endpoint latency is
  // one round-trip, not the sum of three.
  const [vendorsRes, productsRes, movementsRes] = await Promise.all([
    supabase.from('vendors').select('id, plan, created_at'),
    supabase.from('products').select('id, vendor_id, unit_cost_cents, on_hand'),
    supabase.from('stock_movements').select('vendor_id, reason, unit_cost_cents, created_at'),
  ]);

  for (const r of [vendorsRes, productsRes, movementsRes]) {
    if (r.error) {
      console.error('merqo metrics: read failed', r.error.message);
      return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
    }
  }

  const metrics = computeStockkitMetrics({
    nowMs: Date.now(),
    vendors: (vendorsRes.data ?? []) as { id: string; plan: VendorPlan; created_at: string }[],
    products: (productsRes.data ?? []) as {
      id: string;
      vendor_id: string;
      unit_cost_cents: number;
      on_hand: number;
    }[],
    movements: (movementsRes.data ?? []) as {
      vendor_id: string;
      reason: StockMovementReason;
      unit_cost_cents: number | null;
      created_at: string;
    }[],
  });

  return NextResponse.json({
    product: 'stockkit',
    generated_at: new Date().toISOString(),
    ...metrics,
  });
});
