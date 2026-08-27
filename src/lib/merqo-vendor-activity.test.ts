import { describe, expect, it } from 'vitest';

import { computeVendorActivity } from './merqo-vendor-activity';

const NOW = Date.parse('2026-08-27T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

describe('computeVendorActivity', () => {
  it('reports active true with the plan/status/metrics/lastActivityAt for a healthy vendor', () => {
    const vendor = { id: 'v1', plan: 'pro' as const, created_at: iso(200 * DAY) };
    const products = [
      { id: 'p1', vendor_id: 'v1' },
      { id: 'p2', vendor_id: 'v1' },
    ];
    const movements = [
      { vendor_id: 'v1', reason: 'restock' as const, created_at: iso(1 * DAY) },
      { vendor_id: 'v1', reason: 'waste' as const, created_at: iso(2 * DAY) },
    ];

    const activity = computeVendorActivity(vendor, products, movements, NOW);

    expect(activity.active).toBe(true);
    expect(activity.plan).toBe('pro');
    expect(activity.status).toBe('healthy');
    expect(activity.metrics).toEqual([
      { label: 'Products', value: '2' },
      { label: 'Stock movements (30d)', value: '2' },
      { label: 'Waste ratio (30d)', value: '—' },
    ]);
    expect(activity.lastActivityAt).toBe(iso(1 * DAY));
  });

  it('renders a numeric waste ratio once the 30d sample is large enough', () => {
    const vendor = { id: 'v1', plan: 'free' as const, created_at: iso(200 * DAY) };
    const movements = [
      ...Array.from({ length: 4 }, () => ({
        vendor_id: 'v1',
        reason: 'restock' as const,
        created_at: iso(1 * DAY),
      })),
      { vendor_id: 'v1', reason: 'waste' as const, created_at: iso(1 * DAY) },
    ];

    const activity = computeVendorActivity(vendor, [], movements, NOW);

    expect(activity.metrics).toContainEqual({ label: 'Waste ratio (30d)', value: '20%' });
  });

  it('reports zero products/movements and a null lastActivityAt for a brand-new vendor', () => {
    const vendor = { id: 'v1', plan: 'free' as const, created_at: iso(0) };

    const activity = computeVendorActivity(vendor, [], [], NOW);

    expect(activity.status).toBe('new');
    expect(activity.metrics).toEqual([
      { label: 'Products', value: '0' },
      { label: 'Stock movements (30d)', value: '0' },
      { label: 'Waste ratio (30d)', value: '—' },
    ]);
    expect(activity.lastActivityAt).toBeNull();
  });
});
