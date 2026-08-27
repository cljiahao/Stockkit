import { describe, expect, it } from 'vitest';

import { computeStockkitMetrics } from './metrics';

const NOW = Date.parse('2026-08-27T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

describe('computeStockkitMetrics', () => {
  it('sums unit_cost_cents of restock movements for revenue, all-time and 30d', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [{ id: 'v1', plan: 'free', created_at: iso(200 * DAY) }],
      products: [],
      movements: [
        { vendor_id: 'v1', reason: 'restock', unit_cost_cents: 500, created_at: iso(1 * DAY) },
        { vendor_id: 'v1', reason: 'restock', unit_cost_cents: 300, created_at: iso(40 * DAY) },
        { vendor_id: 'v1', reason: 'waste', unit_cost_cents: 999, created_at: iso(1 * DAY) },
      ],
    });

    expect(metrics.revenue_cents_30d).toBe(500);
    expect(metrics.revenue_cents_all).toBe(800);
  });

  it('treats a null unit_cost_cents as 0 rather than throwing', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [],
      products: [],
      movements: [
        { vendor_id: 'v1', reason: 'restock', unit_cost_cents: null, created_at: iso(1 * DAY) },
      ],
    });

    expect(metrics.revenue_cents_all).toBe(0);
  });

  it('computes gmv as a snapshot of on-hand inventory value across all products', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [],
      products: [
        { id: 'p1', vendor_id: 'v1', unit_cost_cents: 200, on_hand: 10 },
        { id: 'p2', vendor_id: 'v1', unit_cost_cents: 50, on_hand: 4 },
      ],
      movements: [],
    });

    expect(metrics.gmv_cents_30d).toBe(2200);
  });

  it('counts active_vendors as vendors with at least one movement in the trailing 30d', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [
        { id: 'v1', plan: 'free', created_at: iso(200 * DAY) },
        { id: 'v2', plan: 'free', created_at: iso(200 * DAY) },
      ],
      products: [],
      movements: [
        { vendor_id: 'v1', reason: 'restock', unit_cost_cents: 100, created_at: iso(1 * DAY) },
      ],
    });

    expect(metrics.active_vendors).toBe(1);
  });

  it('splits orders_7d / orders_prev_7d across the two trailing windows', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [],
      products: [],
      movements: [
        { vendor_id: 'v1', reason: 'adjustment', unit_cost_cents: null, created_at: iso(1 * DAY) },
        { vendor_id: 'v1', reason: 'adjustment', unit_cost_cents: null, created_at: iso(10 * DAY) },
      ],
    });

    expect(metrics.orders_7d).toBe(1);
    expect(metrics.orders_prev_7d).toBe(1);
  });

  it('counts signups_7d from vendor created_at within the trailing 7d', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [
        { id: 'v1', plan: 'free', created_at: iso(1 * DAY) },
        { id: 'v2', plan: 'free', created_at: iso(20 * DAY) },
      ],
      products: [],
      movements: [],
    });

    expect(metrics.signups_7d).toBe(1);
  });

  it('reports total/pro vendor counts and a matching funnel', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [
        { id: 'v1', plan: 'pro', created_at: iso(200 * DAY) },
        { id: 'v2', plan: 'free', created_at: iso(200 * DAY) },
      ],
      products: [{ id: 'p1', vendor_id: 'v1', unit_cost_cents: 100, on_hand: 1 }],
      movements: [
        { vendor_id: 'v1', reason: 'restock', unit_cost_cents: 100, created_at: iso(1 * DAY) },
      ],
    });

    expect(metrics.total_vendors).toBe(2);
    expect(metrics.pro_vendors).toBe(1);
    expect(metrics.funnel).toEqual({
      signed_up: 2,
      with_booth: 1,
      with_order: 1,
      pro: 1,
    });
  });

  it('always reports pending_upgrade_requests as 0', () => {
    const metrics = computeStockkitMetrics({
      nowMs: NOW,
      vendors: [],
      products: [],
      movements: [],
    });
    expect(metrics.pending_upgrade_requests).toBe(0);
  });
});
