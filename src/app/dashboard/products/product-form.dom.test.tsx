// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Product } from '@/lib/types';
import { ProductForm } from './product-form';

vi.mock('./actions', () => ({
  saveProduct: vi.fn(),
  deleteProduct: vi.fn(),
  getProductComponents: vi.fn(),
  saveProductComponents: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { deleteProduct, getProductComponents, saveProduct, saveProductComponents } from './actions';

// jsdom has no ResizeObserver; the Active switch (Radix Switch, via
// @radix-ui/react-use-size) reads it on mount. No other dom test in this repo
// renders a Switch yet, so this stub lives here rather than a global setup file.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(() => cleanup());

const baseProduct: Product = {
  id: 'p1',
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

describe('ProductForm', () => {
  beforeEach(() => {
    vi.mocked(saveProduct).mockReset().mockResolvedValue({ success: true, productId: 'new-id' });
    vi.mocked(deleteProduct).mockReset().mockResolvedValue({ success: true });
    vi.mocked(getProductComponents)
      .mockReset()
      .mockResolvedValue({ success: true, components: [] });
    vi.mocked(saveProductComponents).mockReset().mockResolvedValue({ success: true });
  });

  it('lets an existing product add a component row and save it', async () => {
    const user = userEvent.setup();
    vi.mocked(getProductComponents).mockResolvedValue({ success: true, components: [] });
    vi.mocked(saveProductComponents).mockResolvedValue({ success: true });

    render(<ProductForm product={{ ...baseProduct, id: 'p1' }} onSaved={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /add component/i }));
    await user.type(screen.getByLabelText(/component product/i), 'raw-material-id');
    const quantityInput = screen.getByLabelText(/quantity per unit/i);
    await user.clear(quantityInput);
    await user.type(quantityInput, '2');
    await user.click(screen.getByRole('button', { name: /save components/i }));

    await waitFor(() =>
      expect(saveProductComponents).toHaveBeenCalledWith('p1', [
        { component_product_id: 'raw-material-id', quantity_per_unit: 2 },
      ])
    );
  });

  it('does not render the "Consists of" section for a new product', () => {
    render(<ProductForm onSaved={vi.fn()} />);
    expect(screen.queryByText(/consists of/i)).toBeNull();
  });

  it('loads existing components on mount for an existing product', async () => {
    vi.mocked(getProductComponents).mockResolvedValue({
      success: true,
      components: [
        {
          parent_product_id: 'p1',
          component_product_id: 'raw-1',
          quantity_per_unit: 3,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
    });

    render(<ProductForm product={{ ...baseProduct, id: 'p1' }} onSaved={vi.fn()} />);

    expect(await screen.findByDisplayValue('raw-1')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });
});
