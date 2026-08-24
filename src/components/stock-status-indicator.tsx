import { STOCK_STATUS_DOT_CLASS, STOCK_STATUS_LABEL, type StockStatus } from '@/lib/stock';
import { cn } from '@/lib/utils';

/** Dot + label pair, shared by every place a product's stock status is shown. */
export function StockStatusIndicator({
  status,
  textClassName = 'text-xs',
}: {
  status: StockStatus;
  textClassName?: string;
}) {
  return (
    <>
      <span className={cn('size-2 shrink-0 rounded-full', STOCK_STATUS_DOT_CLASS[status])} />
      <span className={cn('text-muted-foreground', textClassName)}>
        {STOCK_STATUS_LABEL[status]}
      </span>
    </>
  );
}
