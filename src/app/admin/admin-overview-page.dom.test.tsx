// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock('@/lib/admin-data', () => ({
  platformTotals: vi.fn(async () => ({
    vendors: 5,
    freeVendors: 3,
    proVendors: 2,
    products: 40,
    activeProducts: 35,
    stockMovements: 900,
  })),
  recentActivity: vi.fn(async () => [
    {
      id: 'e1',
      delta: 5,
      reason: 'restock',
      created_at: '2026-07-10T00:00:00Z',
      vendor_name: 'Kopi Stall',
      product_name: 'Kopi O',
    },
    {
      id: 'e2',
      delta: -2,
      reason: 'waste',
      created_at: '2026-07-11T00:00:00Z',
      vendor_name: 'Bakery',
      product_name: 'Bread',
    },
  ]),
}));

import AdminOverviewPage from './page';

describe('AdminOverviewPage', () => {
  it('renders platform totals and recent activity', async () => {
    render(await AdminOverviewPage());
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('900')).toBeInTheDocument();
    expect(screen.getByText('Kopi O')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('shows an empty state when there is no activity yet', async () => {
    const { recentActivity } = await import('@/lib/admin-data');
    vi.mocked(recentActivity).mockResolvedValueOnce([]);
    render(await AdminOverviewPage());
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });
});
