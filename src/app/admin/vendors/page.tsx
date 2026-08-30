import { VendorsTable } from '@/app/admin/vendors/vendors-table';
import { ElevatedCard } from '@/components/elevated-card';
import { requireAdmin } from '@/lib/admin';
import { listVendors } from '@/lib/admin-data';

export const revalidate = 0;

export default async function AdminVendorsPage() {
  await requireAdmin();

  const vendors = await listVendors();

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Internal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Grant or remove a vendor&apos;s Pro plan.
        </p>
      </div>

      <ElevatedCard>
        <VendorsTable rows={vendors} />
      </ElevatedCard>
    </main>
  );
}
