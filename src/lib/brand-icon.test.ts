import type { CSSProperties, ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { BRAND_PALE, BRAND_STEEL, brandIcon } from './brand-icon';

function props(element: ReactElement) {
  return element.props as { style: CSSProperties; children: string };
}

describe('brandIcon', () => {
  it('renders the S mark with the shared formula and current brand colors', () => {
    const { style, children } = props(brandIcon(32));
    expect(children).toBe('S');
    expect(style.width).toBe(32);
    expect(style.height).toBe(32);
    expect(style.background).toBe(BRAND_STEEL);
    expect(style.color).toBe(BRAND_PALE);
    expect(style.fontSize).toBeCloseTo(32 * 0.62);
    expect(style.borderRadius).toBeCloseTo(32 * 0.22);
    expect(style.fontWeight).toBe(700);
  });

  it('scales fontSize and borderRadius with size', () => {
    const { style } = props(brandIcon(180));
    expect(style.fontSize).toBeCloseTo(180 * 0.62);
    expect(style.borderRadius).toBeCloseTo(180 * 0.22);
  });
});
