// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock('@/lib/admin-data', () => ({
  auditLog: vi.fn(async () => [
    {
      id: 'a1',
      actor: 'Kopi Stall',
      action: 'delete_product',
      target: 'p1',
      detail: 'name: Kopi O',
      created_at: '2026-08-02T00:00:00Z',
    },
    {
      id: 'a2',
      actor: 'admin-1',
      action: 'set_pricing',
      target: null,
      detail: 'monthly_cents: 1999',
      created_at: '2026-08-01T00:00:00Z',
    },
  ]),
}));

import AdminActivityPage from './page';

describe('AdminActivityPage', () => {
  it('renders audit rows with human-readable action labels', async () => {
    render(await AdminActivityPage());

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Delete product')).toBeInTheDocument();
    expect(screen.getByText('Set pricing')).toBeInTheDocument();
    expect(screen.getByText('Kopi Stall')).toBeInTheDocument();
    expect(screen.getByText('admin-1')).toBeInTheDocument();
    expect(screen.getByText('name: Kopi O')).toBeInTheDocument();
    expect(screen.getByText('p1')).toBeInTheDocument();
  });

  it('falls back to the raw action string for an unmapped action', async () => {
    const { auditLog } = await import('@/lib/admin-data');
    vi.mocked(auditLog).mockResolvedValueOnce([
      {
        id: 'a3',
        actor: 'admin-1',
        action: 'some_future_action',
        target: null,
        detail: null,
        created_at: '2026-08-03T00:00:00Z',
      },
    ]);

    render(await AdminActivityPage());
    expect(screen.getByText('some_future_action')).toBeInTheDocument();
  });

  it('shows the shared empty state when there is no audit history yet', async () => {
    const { auditLog } = await import('@/lib/admin-data');
    vi.mocked(auditLog).mockResolvedValueOnce([]);

    render(await AdminActivityPage());
    expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument();
  });
});
