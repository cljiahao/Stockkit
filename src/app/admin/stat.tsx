import { ElevatedCard } from '@/components/elevated-card';
import { cn } from '@/lib/utils';

/** A back-office figure tile: a small uppercase label over a big value. */
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
      <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{value}</p>
    </ElevatedCard>
  );
}
