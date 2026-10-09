/**
 * Shared stock-level classification, used by the dashboard overview stats and
 * the products workspace's status chips. Thresholds mirror the DB CHECK
 * constraints (on_hand/low_stock_threshold are both >= 0, migration 0001).
 */
import type { StockMovementReason } from './types';

export type StockStatus = 'ok' | 'low' | 'out';

export function stockMovementReasonLabel(reason: string): string {
  return Object.hasOwn(STOCK_MOVEMENT_REASON_LABEL, reason)
    ? STOCK_MOVEMENT_REASON_LABEL[reason as StockMovementReason]
    : reason;
}

export const STOCK_MOVEMENT_REASON_LABEL: Record<StockMovementReason, string> = {
  restock: 'Restock',
  waste: 'Waste',
  adjustment: 'Adjustment',
  initial: 'Initial balance',
};

export function stockStatusFor(onHand: number, lowStockThreshold: number): StockStatus {
  if (onHand <= 0) return 'out';
  if (onHand <= lowStockThreshold) return 'low';
  return 'ok';
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  ok: 'In stock',
  low: 'Low',
  out: 'Out',
};

export const STOCK_STATUS_DOT_CLASS: Record<StockStatus, string> = {
  ok: 'bg-stock-ok',
  low: 'bg-stock-low',
  out: 'bg-stock-out',
};
