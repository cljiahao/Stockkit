import { describe, expect, it } from 'vitest';
import { ENTITLEMENTS, normalizePlan, resolvePlanView } from './plan';

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

describe('resolvePlanView', () => {
  it('renders Free as capped metrics, no CSV line, and an upgrade CTA', () => {
    const view = resolvePlanView('free', ENTITLEMENTS.free);
    expect(view.tier).toBe('free');
    expect(view.label).toBe('Free');
    expect(view.showUpgrade).toBe(true);
    expect(view.features).toEqual([
      { kind: 'metric', prefix: 'Up to', value: 20, suffix: 'active products' },
      { kind: 'metric', prefix: 'Last', value: 10, suffix: 'stock movements per product' },
    ]);
  });

  it('renders Pro as unlimited text lines, CSV export, and no upgrade CTA', () => {
    const view = resolvePlanView('pro', ENTITLEMENTS.pro);
    expect(view.label).toBe('Pro');
    expect(view.showUpgrade).toBe(false);
    expect(view.features).toEqual([
      { kind: 'text', text: 'Unlimited products' },
      { kind: 'text', text: 'Full stock movement history' },
      { kind: 'text', text: 'CSV export' },
    ]);
  });

  it('never advertises the unbuilt valuation-trend feature on Pro', () => {
    const view = resolvePlanView('pro', ENTITLEMENTS.pro);
    const hasComingSoonClaim = view.features.some(
      (f) => f.kind === 'text' && /coming soon/i.test(f.text)
    );
    expect(hasComingSoonClaim).toBe(false);
  });

  it('keeps every numeric limit out of the surrounding prose so it can be font-mono', () => {
    const metrics = resolvePlanView('free', ENTITLEMENTS.free).features.filter(
      (f) => f.kind === 'metric'
    );
    expect(metrics).toHaveLength(2);
    for (const metric of metrics) {
      expect(typeof metric.value).toBe('number');
      expect(metric.prefix).not.toMatch(/\d/);
      expect(metric.suffix).not.toMatch(/\d/);
    }
  });
});
