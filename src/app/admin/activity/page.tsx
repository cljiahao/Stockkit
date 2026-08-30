import type { AuditLogEntry } from '@merqo/ui';

import { AdminActivityLog } from '@/app/admin/activity/activity-log';
import { requireAdmin } from '@/lib/admin';
import { auditLog } from '@/lib/admin-data';

export const revalidate = 0;

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

      <AdminActivityLog entries={entries} />
    </main>
  );
}
