import { ElevatedCard } from '@/components/elevated-card';
import { cn } from '@/lib/utils';
import { StatTile } from '@merqo/ui';

/** A back-office figure tile: wraps @merqo/ui's shared StatTile in stockkit's own card shell. */
export function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <ElevatedCard className={cn('p-4', className)}>
      <StatTile label={label} value={String(value)} valueClassName="font-mono" />
    </ElevatedCard>
  );
}
