// @vitest-environment jsdom
import type { Product } from '@/lib/types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ProductsWorkspace } from './products-workspace';

const { saveProduct } = vi.hoisted(() => ({ saveProduct: vi.fn() }));
vi.mock('./actions', () => ({
  saveProduct,
  archiveProduct: vi.fn(),
  exportProductMovementsCsv: vi.fn(),
  recordStockMovement: vi.fn(),
  getProductMovements: vi.fn().mockResolvedValue({ success: true, movements: [] }),
}));

it('does not submit another product draft or restock cost after switching selection', async () => {
  const first: Product = {
    id: '11111111-1111-4111-8111-111111111111',
    vendor_id: 'vendor',
    name: 'Rice',
    unit: 'kg',
    unit_cost_cents: 500,
    on_hand: 10,
    low_stock_threshold: 2,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
  const second = {
    ...first,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Beans',
    unit_cost_cents: 900,
    low_stock_threshold: 7,
  };
  saveProduct.mockResolvedValue({ success: true, productId: second.id });
  render(<ProductsWorkspace initialProducts={[first, second]} />);
  const firstRows = screen.getAllByRole('button', { name: /Rice/i });
  fireEvent.click(firstRows[firstRows.length - 1]);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved rice draft' } });
  fireEvent.change(screen.getByLabelText('Unit cost this restock ($)'), {
    target: { value: '88' },
  });
  const secondRows = screen.getAllByRole('button', { name: /Beans/i });
  fireEvent.click(secondRows[secondRows.length - 1]);
  expect(screen.getByLabelText('Name')).toHaveValue('Beans');
  expect(screen.getByLabelText('Unit cost ($)')).toHaveValue('9.00');
  expect(screen.getByLabelText('Unit cost this restock ($)')).toHaveValue('9.00');
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() =>
    expect(saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: second.id,
        name: 'Beans',
        unit_cost_cents: 900,
        low_stock_threshold: 7,
      })
    )
  );
});
