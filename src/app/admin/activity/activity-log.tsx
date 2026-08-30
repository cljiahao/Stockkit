'use client';

import { AuditLogTable, type AuditLogEntry } from '@merqo/ui';

const ACTION_LABEL: Record<string, string> = {
  set_vendor_plan: 'Set vendor plan',
  set_pricing: 'Set pricing',
  delete_product: 'Delete product',
};

function formatAction(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/**
 * Client wrapper that owns the `formatAction` callback `@merqo/ui`'s
 * `AuditLogTable` takes — a function prop can't cross the RSC boundary from
 * the Server Component page, so the page passes only the serializable
 * `entries` and this component supplies the callback.
 */
export function AdminActivityLog({ entries }: { entries: AuditLogEntry[] }) {
  return <AuditLogTable entries={entries} formatAction={formatAction} />;
}
