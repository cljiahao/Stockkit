// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({
  recordStockMovement: vi.fn(async () => ({ success: true })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { StockLogForm } from './stock-log-form';

// jsdom has no ResizeObserver — the Select primitive (Radix) needs one to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const product = {
  id: 'p1',
  vendor_id: 'v1',
  name: 'Chicken thigh',
  unit: 'kg',
  unit_cost_cents: 500,
  on_hand: 10,
  low_stock_threshold: 2,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

afterEach(() => cleanup());

describe('StockLogForm', () => {
  it('shows an inline error and marks the field invalid on an unparseable restock unit cost', async () => {
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={vi.fn()} />);

    const costInput = screen.getByLabelText(/unit cost this restock/i);
    await user.clear(costInput);
    await user.type(costInput, '-5');
    await user.click(screen.getByRole('button', { name: /restock/i }));

    expect(screen.getByText('Enter a valid unit cost')).toBeTruthy();
    expect(costInput.getAttribute('aria-invalid')).toBe('true');
  });
});
