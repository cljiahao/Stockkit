import { describe, expect, it } from 'vitest';
import { buildVendorHealth, statusRank, vendorStatus, type VendorStatus } from './vendor-health';

const NOW = Date.parse('2026-08-27T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function iso(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString();
}

describe('vendorStatus', () => {
  it('flags attention when waste movements exceed 30% of a 30d sample of at least 5', () => {
    const status = vendorStatus(
      {
        createdAt: iso(200 * DAY),
        productCount: 3,
        totalMovements: 20,
        movements30d: 10,
        wasteMovements30d: 4,
        lastMovementAt: iso(1 * DAY),
      },
      NOW
    );
    expect(status).toBe('attention');
  });

  it('does not flag attention below the 30% waste ratio', () => {
    const status = vendorStatus(
      {
        createdAt: iso(200 * DAY),
        productCount: 3,
        totalMovements: 20,
        movements30d: 10,
        wasteMovements30d: 3,
        lastMovementAt: iso(1 * DAY),
      },
      NOW
    );
    expect(status).toBe('healthy');
  });

  it('does not flag attention when the 30d sample is below the minimum size, even at 100% waste', () => {
    const status = vendorStatus(
      {
        createdAt: iso(200 * DAY),
        productCount: 1,
        totalMovements: 1,
        movements30d: 1,
        wasteMovements30d: 1,
        lastMovementAt: iso(1 * DAY),
      },
      NOW
    );
    expect(status).toBe('healthy');
  });

  it('flags stuck when signed up 3+ days ago with zero products', () => {
    const status = vendorStatus(
      {
        createdAt: iso(4 * DAY),
        productCount: 0,
        totalMovements: 0,
        movements30d: 0,
        wasteMovements30d: 0,
        lastMovementAt: null,
      },
      NOW
    );
    expect(status).toBe('stuck');
  });

  it('flags stuck when there are products but zero stock movements ever', () => {
    const status = vendorStatus(
      {
        createdAt: iso(1 * DAY),
        productCount: 2,
        totalMovements: 0,
        movements30d: 0,
        wasteMovements30d: 0,
        lastMovementAt: null,
      },
      NOW
    );
    expect(status).toBe('stuck');
  });

  it('flags quiet when the last movement was more than 14 days ago', () => {
    const status = vendorStatus(
      {
        createdAt: iso(60 * DAY),
        productCount: 2,
        totalMovements: 8,
        movements30d: 0,
        wasteMovements30d: 0,
        lastMovementAt: iso(20 * DAY),
      },
      NOW
    );
    expect(status).toBe('quiet');
  });

  it('flags new when signed up within the last 3 days with no products yet', () => {
    const status = vendorStatus(
      {
        createdAt: iso(1 * DAY),
        productCount: 0,
        totalMovements: 0,
        movements30d: 0,
        wasteMovements30d: 0,
        lastMovementAt: null,
      },
      NOW
    );
    expect(status).toBe('new');
  });

  it('flags healthy when a movement was logged within the last 14 days', () => {
    const status = vendorStatus(
      {
        createdAt: iso(60 * DAY),
        productCount: 2,
        totalMovements: 8,
        movements30d: 3,
        wasteMovements30d: 0,
        lastMovementAt: iso(5 * DAY),
      },
      NOW
    );
    expect(status).toBe('healthy');
  });

  it('does not flag stuck for a vendor with no products who just signed up', () => {
    const status = vendorStatus(
      {
        createdAt: iso(1 * DAY),
        productCount: 0,
        totalMovements: 0,
        movements30d: 0,
        wasteMovements30d: 0,
        lastMovementAt: null,
      },
      NOW
    );
    expect(status).not.toBe('stuck');
  });
});

describe('statusRank', () => {
  it('orders statuses most-urgent first: attention > stuck > quiet > new > healthy', () => {
    const order: VendorStatus[] = ['attention', 'stuck', 'quiet', 'new', 'healthy'];
    const ranks = order.map(statusRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(5);
  });
});

describe('buildVendorHealth', () => {
  it('rolls up products and movements per vendor and classifies each', () => {
    const vendors = [
      { id: 'v-attention', created_at: iso(100 * DAY) },
      { id: 'v-stuck-no-products', created_at: iso(10 * DAY) },
      { id: 'v-new', created_at: iso(1 * DAY) },
    ];
    const products = [
      { id: 'p1', vendor_id: 'v-attention' },
      { id: 'p2', vendor_id: 'v-attention' },
    ];
    const movements = [
      ...Array.from({ length: 4 }, (_, i) => ({
        vendor_id: 'v-attention',
        reason: 'waste' as const,
        created_at: iso(i * DAY),
      })),
      { vendor_id: 'v-attention', reason: 'restock' as const, created_at: iso(2 * DAY) },
    ];

    const health = buildVendorHealth(vendors, products, movements, NOW);

    expect(health.get('v-attention')).toEqual({
      status: 'attention',
      productCount: 2,
      totalMovements: 5,
      movements30d: 5,
      wasteRatio30d: 0.8,
      lastMovementAt: iso(0),
    });
    expect(health.get('v-stuck-no-products')).toEqual({
      status: 'stuck',
      productCount: 0,
      totalMovements: 0,
      movements30d: 0,
      wasteRatio30d: null,
      lastMovementAt: null,
    });
    expect(health.get('v-new')).toEqual({
      status: 'new',
      productCount: 0,
      totalMovements: 0,
      movements30d: 0,
      wasteRatio30d: null,
      lastMovementAt: null,
    });
  });

  it('ignores movements older than the 30d attention window for the waste ratio', () => {
    const vendors = [{ id: 'v1', created_at: iso(100 * DAY) }];
    const products = [{ id: 'p1', vendor_id: 'v1' }];
    const movements = [
      { vendor_id: 'v1', reason: 'waste' as const, created_at: iso(40 * DAY) },
      { vendor_id: 'v1', reason: 'waste' as const, created_at: iso(40 * DAY) },
      { vendor_id: 'v1', reason: 'restock' as const, created_at: iso(1 * DAY) },
    ];

    const health = buildVendorHealth(vendors, products, movements, NOW);

    expect(health.get('v1')?.movements30d).toBe(1);
    expect(health.get('v1')?.wasteRatio30d).toBeNull();
    expect(health.get('v1')?.status).toBe('healthy');
  });
});
