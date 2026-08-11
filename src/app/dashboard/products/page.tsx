import { redirect } from 'next/navigation';

import { createServerClient } from '@/lib/supabase/server';
import { ProductsWorkspace } from './products-workspace';

// Product list + on-hand quantities change on every stock movement — never
// statically prerender.
export const revalidate = 0;

export default async function ProductsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('products').select('*').order('name');

  return (
    <div className="py-8">
      <ProductsWorkspace initialProducts={data ?? []} />
    </div>
  );
}
