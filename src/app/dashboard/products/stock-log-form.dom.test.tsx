// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Product } from '@/lib/types';
import { StockLogForm } from './stock-log-form';

vi.mock('./actions', () => ({
  recordStockMovement: vi.fn(),
  recordLinkedMovement: vi.fn(),
  getProductComponents: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { getProductComponents, recordLinkedMovement, recordStockMovement } from './actions';

afterEach(() => cleanup());

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const COMPONENT_ID = '22222222-2222-4222-8222-222222222222';

const baseProduct: Product = {
  id: PRODUCT_ID,
  vendor_id: 'v1',
  name: 'Existing product',
  unit: 'unit',
  unit_cost_cents: 500,
  on_hand: 10,
  low_stock_threshold: 2,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('StockLogForm', () => {
  beforeEach(() => {
    vi.mocked(getProductComponents)
      .mockReset()
      .mockResolvedValue({ success: true, components: [] });
    vi.mocked(recordStockMovement)
      .mockReset()
      .mockResolvedValue({ success: true, product: { ...baseProduct, on_hand: 11 } });
    vi.mocked(recordLinkedMovement)
      .mockReset()
      .mockResolvedValue({ success: true, product: { ...baseProduct, on_hand: 15 } });
  });

  it('calls recordStockMovement for a product with no components', async () => {
    const user = userEvent.setup();
    render(<StockLogForm product={baseProduct} onRecorded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /increase quantity/i }));
    await user.click(screen.getByRole('button', { name: /^restock/i }));

    await waitFor(() => expect(recordStockMovement).toHaveBeenCalled());
    expect(recordLinkedMovement).not.toHaveBeenCalled();
  });

  it('calls recordLinkedMovement with per-component overrides when the product has components', async () => {
    const user = userEvent.setup();
    vi.mocked(getProductComponents).mockResolvedValue({
      success: true,
      components: [
        {
          parent_product_id: PRODUCT_ID,
          component_product_id: COMPONENT_ID,
          quantity_per_unit: 2,
          created_at: 'now',
        },
      ],
    });

    render(<StockLogForm product={baseProduct} onRecorded={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
    await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
    await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
    await user.click(await screen.findByRole('button', { name: /increase quantity/i }));
    const actualInput = screen.getByLabelText(new RegExp(`${COMPONENT_ID} actually used`, 'i'));
    await user.clear(actualInput);
    await user.type(actualInput, '9');
    await user.click(screen.getByRole('button', { name: /^restock/i }));

    await waitFor(() =>
      expect(recordLinkedMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: PRODUCT_ID,
          delta: 5,
          component_overrides: { [COMPONENT_ID]: -9 },
        })
      )
    );
    expect(recordStockMovement).not.toHaveBeenCalled();
  });

  it('hides component-usage inputs once linked components load for a fresh product', async () => {
    vi.mocked(getProductComponents).mockResolvedValue({ success: true, components: [] });

    render(<StockLogForm product={baseProduct} onRecorded={vi.fn()} />);

    await waitFor(() => expect(getProductComponents).toHaveBeenCalledWith(PRODUCT_ID));
    expect(screen.queryByText(/components used/i)).toBeNull();
  });
});
