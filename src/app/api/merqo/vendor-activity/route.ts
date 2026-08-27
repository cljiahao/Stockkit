import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { listAllUsers } from '@/lib/list-all-users';
import { bearerOk } from '@/lib/merqo-auth';
import { computeVendorActivity } from '@/lib/merqo-vendor-activity';
import { createServiceClient } from '@/lib/supabase/server';
import type { StockMovementReason, VendorPlan } from '@/lib/types';
import { withLogging } from '@/lib/utils/with-logging';

export const revalidate = 0;

const querySchema = z.object({ email: z.string().email() });

export const GET = withLogging(async (request: NextRequest): Promise<NextResponse> => {
  if (!bearerOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ email: searchParams.get('email') ?? '' });
  if (!parsed.success) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const usersRes = await listAllUsers(supabase);
  if (usersRes.error) {
    console.error('merqo vendor-activity: read failed', usersRes.error.message);
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }

  const key = parsed.data.email.toLowerCase();
  const user = (usersRes.data?.users ?? []).find((u) => u.email?.toLowerCase() === key);
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const vendorRes = await supabase
    .from('vendors')
    .select('id, plan, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (vendorRes.error) {
    console.error('merqo vendor-activity: read failed', vendorRes.error.message);
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }
  // No stockkit.vendors row at all — this vendor has never touched stockkit,
  // a clean 404 rather than a 200 with empty fields.
  if (!vendorRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const vendor = vendorRes.data as { id: string; plan: VendorPlan; created_at: string };

  const [productsRes, movementsRes] = await Promise.all([
    supabase.from('products').select('id, vendor_id').eq('vendor_id', user.id),
    supabase
      .from('stock_movements')
      .select('vendor_id, reason, created_at')
      .eq('vendor_id', user.id),
  ]);
  if (productsRes.error || movementsRes.error) {
    console.error(
      'merqo vendor-activity: read failed',
      productsRes.error?.message ?? movementsRes.error?.message
    );
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }

  const payload = computeVendorActivity(
    vendor,
    productsRes.data ?? [],
    (movementsRes.data ?? []) as {
      vendor_id: string;
      reason: StockMovementReason;
      created_at: string;
    }[],
    Date.now()
  );

  return NextResponse.json(payload);
});
