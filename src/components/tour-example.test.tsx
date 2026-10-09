import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StockStatusIndicator } from './stock-status-indicator';
import { renderTourExample } from './tour-example';
describe('renderTourExample', () => {
  it('preserves the actual indicator markup without shipping the React server renderer', () => {
    expect(renderTourExample()).toBe(renderToStaticMarkup(<StockStatusIndicator status="low" />));
  });
});
