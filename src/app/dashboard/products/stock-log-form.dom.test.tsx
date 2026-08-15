// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';
import type { Product } from '@/lib/types';

const { recordStockMovementMock } = vi.hoisted(() => ({
  recordStockMovementMock: vi.fn(async (): Promise<ActionResult<{ product: Product }>> => ({
    success: true,
    product: {} as Product,
  })),
}));
vi.mock('./actions', () => ({
  recordStockMovement: recordStockMovementMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

import { StockLogForm } from './stock-log-form';

const product = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

afterEach(() => {
  recordStockMovementMock.mockReset();
  recordStockMovementMock.mockResolvedValue({ success: true, product: {} as Product });
});

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

    await user.clear(costInput);
    await user.type(costInput, '5.00');
    await user.click(screen.getByRole('button', { name: /restock/i }));

    expect(screen.queryByText('Enter a valid unit cost')).toBeNull();
    expect(costInput.getAttribute('aria-invalid')).toBe('false');
  });

  it('records a movement and reports it to onRecorded', async () => {
    const onRecorded = vi.fn();
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={onRecorded} />);

    await user.click(screen.getByRole('button', { name: /restock/i }));

    expect(recordStockMovementMock).toHaveBeenCalled();
    expect(onRecorded).toHaveBeenCalled();
  });

  it('shows a toast when recording returns a failure', async () => {
    recordStockMovementMock.mockResolvedValueOnce({ success: false, error: 'Would go negative' });
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /restock/i }));

    expect(toast.error).toHaveBeenCalledWith('Would go negative');
  });

  it('shows a generic toast when recording throws instead of returning an error', async () => {
    recordStockMovementMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /restock/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('sends a negative delta for a waste movement', async () => {
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: /reason/i }));
    await user.click(await screen.findByRole('option', { name: 'Waste' }));
    await user.click(screen.getByRole('button', { name: /waste/i }));

    expect(recordStockMovementMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'waste', delta: -1 })
    );
  });

  it('sends a delta matching the chosen sign for an adjustment movement', async () => {
    const user = userEvent.setup();
    render(<StockLogForm product={product} onRecorded={vi.fn()} />);

    await user.click(screen.getByRole('combobox', { name: /reason/i }));
    await user.click(await screen.findByRole('option', { name: 'Adjustment' }));
    await user.click(screen.getByRole('button', { name: /remove stock/i }));
    await user.click(screen.getByRole('button', { name: /adjustment/i }));

    expect(recordStockMovementMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'adjustment', delta: -1 })
    );
  });
});
