'use client';

import { DataTable, type DataTableColumn } from '@merqo/ui';

import { VendorPlanToggle } from '@/app/admin/vendors/vendor-plan-toggle';
import { VendorStatusBadge } from '@/app/admin/vendors/vendor-status-badge';
import { Badge } from '@/components/ui/badge';
import type { VendorRow } from '@/lib/admin-data';

const columns: DataTableColumn<VendorRow>[] = [
  { header: 'Vendor', cell: (v) => v.name, className: 'font-medium' },
  {
    header: 'Status',
    cell: (v) => <VendorStatusBadge status={v.status} />,
  },
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

/**
 * Client wrapper that owns the `columns` cell renderers and `getRowKey`
 * callback `@merqo/ui`'s `DataTable` takes — function props can't cross the
 * RSC boundary from the Server Component page, so the page passes only the
 * serializable `rows` and this component supplies the callbacks.
 */
export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  return (
    <DataTable rows={rows} columns={columns} getRowKey={(v) => v.id} emptyState="No vendors yet." />
  );
}
