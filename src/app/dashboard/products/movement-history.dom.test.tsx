// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';
import type { StockMovement } from '@/lib/types';

const { getProductMovementsMock } = vi.hoisted(() => ({
  getProductMovementsMock: vi.fn(
    async (): Promise<ActionResult<{ movements: StockMovement[] }>> => ({
      success: true,
      movements: [],
    })
  ),
}));
vi.mock('./actions', () => ({
  getProductMovements: getProductMovementsMock,
}));

import { MovementHistory } from './movement-history';

const movement = (overrides: Partial<StockMovement> = {}): StockMovement => ({
  id: 'm1',
  vendor_id: 'v1',
  product_id: 'p1',
  delta: 5,
  reason: 'restock',
  note: null,
  unit_cost_cents: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

afterEach(() => {
  getProductMovementsMock.mockReset();
  getProductMovementsMock.mockResolvedValue({ success: true, movements: [] });
});

describe('MovementHistory', () => {
  it('shows a loading state, then an empty state when there are no movements', async () => {
    render(<MovementHistory productId="p1" refreshKey={0} />);

    expect(screen.getByText(/loading history/i)).toBeTruthy();
    expect(await screen.findByText(/no stock movements yet/i)).toBeTruthy();
    expect(getProductMovementsMock).toHaveBeenCalledWith('p1');
  });

  it('renders movements with a signed delta and reason label', async () => {
    getProductMovementsMock.mockResolvedValueOnce({
      success: true,
      movements: [
        movement({ id: 'm1', delta: 5, reason: 'restock' }),
        movement({ id: 'm2', delta: -2, reason: 'waste', note: 'spoiled' }),
      ],
    });
    render(<MovementHistory productId="p1" refreshKey={0} />);

    expect(await screen.findByText('Restock')).toBeTruthy();
    expect(screen.getByText('+5')).toBeTruthy();
    expect(screen.getByText('Waste')).toBeTruthy();
    expect(screen.getByText('-2')).toBeTruthy();
    expect(screen.getByText(/spoiled/i)).toBeTruthy();
  });

  it('falls back to an empty list when the fetch fails', async () => {
    getProductMovementsMock.mockResolvedValueOnce({ success: false, error: 'boom' });
    render(<MovementHistory productId="p1" refreshKey={0} />);

    expect(await screen.findByText(/no stock movements yet/i)).toBeTruthy();
  });

  it('re-fetches when refreshKey changes', async () => {
    const { rerender } = render(<MovementHistory productId="p1" refreshKey={0} />);
    await waitFor(() => expect(getProductMovementsMock).toHaveBeenCalledTimes(1));

    rerender(<MovementHistory productId="p1" refreshKey={1} />);
    await waitFor(() => expect(getProductMovementsMock).toHaveBeenCalledTimes(2));
  });
});
