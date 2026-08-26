import { DataTable, type DataTableColumn } from '@merqo/ui';

import { VendorPlanToggle } from '@/app/admin/vendors/vendor-plan-toggle';
import { ElevatedCard } from '@/components/elevated-card';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/admin';
import { listVendors, type VendorRow } from '@/lib/admin-data';

export const revalidate = 0;

const columns: DataTableColumn<VendorRow>[] = [
  { header: 'Vendor', cell: (v) => v.name, className: 'font-medium' },
  {
    header: 'Plan',
    cell: (v) => (v.plan === 'pro' ? <Badge>Pro</Badge> : <Badge variant="outline">Free</Badge>),
  },
  {
    header: 'Products',
    cell: (v) => v.product_count,
    className: 'text-right font-mono tabular-nums',
  },
  {
    header: 'Joined',
    cell: (v) => new Date(v.created_at).toLocaleDateString(),
    className: 'text-muted-foreground',
  },
  {
    header: 'Action',
    cell: (v) => <VendorPlanToggle vendorId={v.id} vendorName={v.name} plan={v.plan} />,
    className: 'text-right',
  },
];

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
        <DataTable
          rows={vendors}
          columns={columns}
          getRowKey={(v) => v.id}
          emptyState="No vendors yet."
        />
      </ElevatedCard>
    </main>
  );
}
