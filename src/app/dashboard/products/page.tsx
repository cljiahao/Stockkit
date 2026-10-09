import { readAllRows } from '@/lib/read-all-rows';
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

  const { data, error } = await readAllRows((after) => {
    const query = supabase.from('products').select('*').order('id', { ascending: true }).limit(500);
    return after === null ? query : query.gt('id', after);
  });
  if (error) throw new Error('Could not load inventory');
  data?.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  return (
    <div className="py-8">
      <ProductsWorkspace initialProducts={data ?? []} />
    </div>
  );
}
