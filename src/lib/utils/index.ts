import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FORM_LABEL_CLASS =
  'text-xs font-semibold uppercase tracking-wider text-muted-foreground';
export const FORM_ERROR_CLASS = 'text-sm font-medium text-destructive';

// Codified type scale for the "ledger" hero-number motif (font-mono
// tabular-nums figures, e.g. inventory value, on-hand count) so every screen
// that surfaces one uses one of a fixed set of sizes instead of an ad hoc
// text-*/font-* combo. Always compose with `cn()`, e.g.
// `cn(ledgerLg, 'text-stock-low')`, so status colors still layer on top.
export const LEDGER_LG_CLASS = 'font-mono text-3xl font-semibold tabular-nums';
export const LEDGER_MD_CLASS = 'font-mono text-2xl font-bold tabular-nums';
export const LEDGER_SM_CLASS = 'font-mono text-sm font-semibold tabular-nums';
