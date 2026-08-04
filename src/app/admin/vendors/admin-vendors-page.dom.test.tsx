// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock('@/app/admin/actions', () => ({
  setVendorPlan: vi.fn(),
}));
vi.mock('@/lib/admin-data', () => ({
  listVendors: vi.fn(async () => [
    {
      id: 'v1',
      name: 'Pro Stall',
      plan: 'pro',
      created_at: '2026-07-01T00:00:00Z',
      product_count: 12,
    },
    {
      id: 'v2',
      name: 'Free Stall',
      plan: 'free',
      created_at: '2026-07-05T00:00:00Z',
      product_count: 3,
    },
  ]),
}));

import AdminVendorsPage from './page';

describe('AdminVendorsPage', () => {
  it('renders vendors with their plan badges and product counts', async () => {
    render(await AdminVendorsPage());
    expect(screen.getByText('Vendors')).toBeInTheDocument();
    expect(screen.getByText('Pro Stall')).toBeInTheDocument();
    expect(screen.getByText('Free Stall')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows an empty state when there are no vendors', async () => {
    const { listVendors } = await import('@/lib/admin-data');
    vi.mocked(listVendors).mockResolvedValueOnce([]);
    render(await AdminVendorsPage());
    expect(screen.getByText('No vendors yet.')).toBeInTheDocument();
  });
});
