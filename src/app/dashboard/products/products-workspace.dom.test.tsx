// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Product } from '@/lib/types';

vi.mock('./product-form', () => ({
  ProductForm: () => <div data-testid="product-form" />,
}));
vi.mock('./product-detail', () => ({
  ProductDetail: ({ product }: { product: Product }) => (
    <div data-testid="product-detail">{product.name}</div>
  ),
}));
vi.mock('./product-row', () => ({
  ProductRow: ({
    product,
    onClick,
  }: {
    product: Product;
    selected?: boolean;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {product.name}
    </button>
  ),
}));

import { ProductsWorkspace } from './products-workspace';

const product = (overrides: Partial<Product> = {}): Product => ({
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
  ...overrides,
});

describe('ProductsWorkspace desktop detail panel', () => {
  it('shows the empty-state placeholder when nothing is selected', () => {
    render(<ProductsWorkspace initialProducts={[product()]} />);

    expect(screen.getByText(/select a product to log stock/i)).toBeTruthy();
  });

  it('shows the product form when starting a new product from the desktop button', async () => {
    const user = userEvent.setup();
    render(<ProductsWorkspace initialProducts={[product()]} />);

    // Two "Add product" buttons render (mobile md:hidden, desktop hidden md:inline-flex) —
    // jsdom doesn't evaluate Tailwind's responsive display classes, so both are queryable;
    // the desktop one (startNewDesktop) is the second in DOM order.
    const addButtons = screen.getAllByRole('button', { name: /add product/i });
    await user.click(addButtons[addButtons.length - 1]);
    expect(screen.getByTestId('product-form')).toBeTruthy();
  });

  it('shows the selected product detail after clicking a row', async () => {
    const user = userEvent.setup();
    render(<ProductsWorkspace initialProducts={[product({ name: 'Chicken thigh' })]} />);

    const rows = screen.getAllByRole('button', { name: 'Chicken thigh' });
    await user.click(rows[rows.length - 1]);

    expect(screen.getByTestId('product-detail')).toHaveTextContent('Chicken thigh');
  });
});
