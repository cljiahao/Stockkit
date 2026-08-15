'use client';

import { useEffect, useState } from 'react';

import type { StockMovement } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getProductMovements } from './actions';

interface Props {
  productId: string;
  // Bumped by the parent after a new movement is recorded, to trigger a refetch.
  refreshKey: number;
}

const REASON_LABEL: Record<string, string> = {
  restock: 'Restock',
  waste: 'Waste',
  adjustment: 'Adjustment',
  initial: 'Initial balance',
};

/** Last ~10 stock_movements rows for a product, newest first. */
export function MovementHistory({ productId, refreshKey }: Props) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Reset before the async fetch so a slow load never shows stale history
    // from the previously selected product.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMovements(null);
    getProductMovements(productId).then((result) => {
      if (cancelled) return;
      setMovements(result.success ? result.movements : []);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, refreshKey]);

  if (movements === null) {
    return <p className="text-muted-foreground py-6 text-center text-sm">Loading history…</p>;
  }
  if (movements.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">No stock movements yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {movements.map((m) => (
        <div
          key={m.id}
          className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{REASON_LABEL[m.reason] ?? m.reason}</p>
            <p className="text-muted-foreground truncate text-xs">
              {new Date(m.created_at).toLocaleString()}
              {m.note ? ` · ${m.note}` : ''}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 font-mono text-sm font-semibold tabular-nums',
              m.delta > 0 ? 'text-stock-ok' : 'text-stock-out'
            )}
          >
            {m.delta > 0 ? '+' : ''}
            {m.delta}
          </span>
        </div>
      ))}
    </div>
  );
}
