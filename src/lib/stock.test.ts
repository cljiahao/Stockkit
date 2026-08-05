import { describe, expect, it } from 'vitest';

import { stockStatusFor } from './stock';

describe('stockStatusFor', () => {
  it('is out when on_hand is zero', () => {
    expect(stockStatusFor(0, 5)).toBe('out');
  });

  it('is out when on_hand is negative', () => {
    expect(stockStatusFor(-1, 5)).toBe('out');
  });

  it('is low when on_hand equals the threshold (boundary is inclusive)', () => {
    expect(stockStatusFor(5, 5)).toBe('low');
  });

  it('is low when on_hand is between zero and the threshold', () => {
    expect(stockStatusFor(3, 5)).toBe('low');
  });

  it('is ok when on_hand is just above the threshold', () => {
    expect(stockStatusFor(6, 5)).toBe('ok');
  });

  it('is ok when on_hand is well above the threshold', () => {
    expect(stockStatusFor(100, 5)).toBe('ok');
  });

  it('is out when on_hand and threshold are both zero (out beats low)', () => {
    expect(stockStatusFor(0, 0)).toBe('out');
  });

  it('is ok when the threshold is zero and on_hand is positive', () => {
    expect(stockStatusFor(1, 0)).toBe('ok');
  });
});
