import { describe, expect, it } from 'vitest';
import { ENTITLEMENTS, normalizePlan } from './plan';

describe('normalizePlan', () => {
  it('returns "pro" only for the exact string "pro"', () => {
    expect(normalizePlan('pro')).toBe('pro');
  });

  it('coerces anything else to "free"', () => {
    expect(normalizePlan('free')).toBe('free');
    expect(normalizePlan(undefined)).toBe('free');
    expect(normalizePlan(null)).toBe('free');
    expect(normalizePlan('PRO')).toBe('free');
    expect(normalizePlan(123)).toBe('free');
  });
});

describe('ENTITLEMENTS', () => {
  it('caps Free at 20 products, 10-row movement history, no CSV export', () => {
    expect(ENTITLEMENTS.free).toEqual({
      tier: 'free',
      maxActiveProducts: 20,
      movementHistoryLimit: 10,
      csvExport: false,
    });
  });

  it('gives Pro unlimited products and history, plus CSV export', () => {
    expect(ENTITLEMENTS.pro).toEqual({
      tier: 'pro',
      maxActiveProducts: null,
      movementHistoryLimit: null,
      csvExport: true,
    });
  });
});
