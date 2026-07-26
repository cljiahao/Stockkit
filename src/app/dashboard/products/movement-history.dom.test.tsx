// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MovementHistory } from './movement-history';

vi.mock('./actions', () => ({
  getProductMovements: vi.fn().mockResolvedValue({
    success: true,
    movements: [
      {
        id: 'm1',
        vendor_id: 'v1',
        product_id: 'p1',
        delta: 5,
        reason: 'restock',
        note: null,
        unit_cost_cents: 150,
        linked_movement_id: 'g1',
        created_at: '2026-07-26T00:00:00Z',
      },
      {
        id: 'm2',
        vendor_id: 'v1',
        product_id: 'raw-1',
        delta: -12,
        reason: 'consumed',
        note: null,
        unit_cost_cents: null,
        linked_movement_id: 'g1',
        created_at: '2026-07-26T00:00:00Z',
      },
      {
        id: 'm3',
        vendor_id: 'v1',
        product_id: 'p1',
        delta: -1,
        reason: 'waste',
        note: null,
        unit_cost_cents: null,
        linked_movement_id: null,
        created_at: '2026-07-25T00:00:00Z',
      },
    ],
  }),
}));

afterEach(() => cleanup());

describe('MovementHistory', () => {
  it('shows a "linked" indicator only on rows sharing a linked_movement_id', async () => {
    render(<MovementHistory productId="p1" refreshKey={0} />);
    expect(await screen.findAllByText(/linked/i)).toHaveLength(2);
    expect(screen.getByText('Consumed')).toBeTruthy();
  });
});
