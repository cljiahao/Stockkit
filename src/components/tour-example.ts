import { STOCK_STATUS_DOT_CLASS, STOCK_STATUS_LABEL } from '@/lib/stock';
import { STOCK_INDICATOR_DOT_CLASS, STOCK_INDICATOR_TEXT_CLASS } from './stock-status-indicator';
/** Constant tour HTML uses the same status tokens as the rendered indicator. */
export function renderTourExample(): string {
  return (
    '<span class="' +
    STOCK_INDICATOR_DOT_CLASS +
    ' ' +
    STOCK_STATUS_DOT_CLASS.low +
    '"></span><span class="' +
    STOCK_INDICATOR_TEXT_CLASS +
    ' text-xs">' +
    STOCK_STATUS_LABEL.low +
    '</span>'
  );
}
