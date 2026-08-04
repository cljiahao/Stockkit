import { VendorPlanToggle } from '@/app/admin/vendors/vendor-plan-toggle';
import { ElevatedCard } from '@/components/elevated-card';
import { Badge } from '@/components/ui/badge';
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

      {vendors.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
          No vendors yet.
        </p>
      ) : (
        <ElevatedCard className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs font-semibold tracking-wider uppercase">
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium">{v.name}</td>
                  <td className="px-4 py-3">
                    {v.plan === 'pro' ? <Badge>Pro</Badge> : <Badge variant="outline">Free</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{v.product_count}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <VendorPlanToggle vendorId={v.id} vendorName={v.name} plan={v.plan} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ElevatedCard>
      )}
    </main>
  );
}
