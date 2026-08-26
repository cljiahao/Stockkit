import { AuditLogTable, type AuditLogEntry } from '@merqo/ui';

import { requireAdmin } from '@/lib/admin';
import { auditLog } from '@/lib/admin-data';

export const revalidate = 0;

const ACTION_LABEL: Record<string, string> = {
  set_vendor_plan: 'Set vendor plan',
  set_pricing: 'Set pricing',
  delete_product: 'Delete product',
};

function formatAction(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

export default async function AdminActivityPage() {
  await requireAdmin();

  const rows = await auditLog(100);
  const entries: AuditLogEntry[] = rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: row.created_at,
  }));

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
          Internal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The most recent admin- and vendor-initiated actions worth reconstructing later.
        </p>
      </div>

      <AuditLogTable entries={entries} formatAction={formatAction} />
    </main>
  );
}
