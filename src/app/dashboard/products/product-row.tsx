'use client';

import { STOCK_STATUS_DOT_CLASS, STOCK_STATUS_LABEL, stockStatusFor } from '@/lib/stock';
import type { Product } from '@/lib/types';
import { cn, LEDGER_SM_CLASS } from '@/lib/utils';

interface Props {
  product: Product;
  selected?: boolean;
  onClick: () => void;
}

/** One product row — shared by the mobile list and the desktop list pane. */
export function ProductRow({ product, selected, onClick }: Props) {
  const status = stockStatusFor(product.on_hand, product.low_stock_threshold);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
        !product.is_active && 'opacity-60'
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{product.name}</p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={cn('size-2 shrink-0 rounded-full', STOCK_STATUS_DOT_CLASS[status])} />
          <span className="text-muted-foreground text-xs">{STOCK_STATUS_LABEL[status]}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={LEDGER_SM_CLASS}>
          {product.on_hand}{' '}
          <span className="text-muted-foreground text-xs font-normal">{product.unit}</span>
        </p>
        <p className="text-muted-foreground font-mono text-xs tabular-nums">
          thr. {product.low_stock_threshold}
        </p>
      </div>
    </button>
  );
}
