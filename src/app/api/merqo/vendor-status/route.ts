import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { listAllUsers } from '@/lib/list-all-users';
import { bearerOk } from '@/lib/merqo-auth';
import { resolveVendorStatus } from '@/lib/merqo-vendor-status';
import { createServiceClient } from '@/lib/supabase/server';
import type { VendorPlan } from '@/lib/types';
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
    console.error('merqo vendor-status: read failed', usersRes.error.message);
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }
  const user = (usersRes.data?.users ?? []).find(
    (candidate) => candidate.email?.toLowerCase() === parsed.data.email.toLowerCase()
  );
  if (!user) return NextResponse.json({ active: false, plan: null });
  const vendorsRes = await supabase
    .from('vendors')
    .select('id, plan')
    .eq('id', user.id)
    .maybeSingle();
  if (vendorsRes.error) {
    console.error('merqo vendor-status: read failed', vendorsRes.error.message);
    return NextResponse.json({ error: 'Upstream unavailable' }, { status: 503 });
  }

  const status = resolveVendorStatus(
    parsed.data.email,
    (usersRes.data?.users ?? []).map((u) => ({ id: u.id, email: u.email ?? null })),
    (vendorsRes.data ? [vendorsRes.data] : []) as { id: string; plan: VendorPlan }[]
  );

  return NextResponse.json(status);
});
