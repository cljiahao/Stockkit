import type { VendorStatus } from '@/lib/vendor-health';
import { StatusBadge } from '@merqo/ui';

// One brand token per status — the five stockkit tokens (primary/secondary/
// accent/muted/destructive) map one-to-one onto the five triage bands, so
// nothing here is a raw Tailwind literal.
const STATUS_CONFIG: Record<VendorStatus, { label: string; className: string }> = {
  attention: {
    label: 'attention',
    className: 'text-destructive border-destructive/35 bg-destructive/12',
  },
  stuck: {
    label: 'stuck',
    className: 'text-primary border-primary/35 bg-primary/12',
  },
  quiet: {
    label: 'quiet',
    className: 'text-muted-foreground border-border bg-muted',
  },
  new: {
    label: 'new',
    className: 'text-secondary-foreground border-secondary/35 bg-secondary/40',
  },
  healthy: {
    label: 'healthy',
    className: 'text-accent-foreground border-accent/35 bg-accent/40',
  },
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <StatusBadge status={status} config={STATUS_CONFIG} />;
}
