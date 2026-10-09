// @vitest-environment jsdom
import type { Product } from '@/lib/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProductDetail } from './product-detail';
vi.mock('./export-history-button', () => ({
  ExportHistoryButton: () => <button>Export CSV (Pro)</button>,
}));
vi.mock('./stock-log-form', () => ({
  StockLogForm: ({
    product,
    onRecorded,
  }: {
    product: Product;
    onRecorded: (product: Product) => void;
  }) => <button onClick={() => onRecorded({ ...product, on_hand: 12 })}>Record restock</button>,
}));
vi.mock('./product-form', () => ({
  ProductForm: ({
    product,
    onSaved,
  }: {
    product: Product;
    onSaved: (product: Product) => void;
  }) => (
    <button onClick={() => onSaved({ ...product, is_active: false })}>
      Archive fixture product
    </button>
  ),
}));
vi.mock('./movement-history', () => ({
  MovementHistory: ({ productId, refreshKey }: { productId: string; refreshKey: number }) => (
    <p>
      History {productId}: {refreshKey}
    </p>
  ),
}));
const product: Product = {
  id: 'p1',
  vendor_id: 'v1',
  name: 'Coffee',
  unit: 'kg',
  on_hand: 10,
  unit_cost_cents: 500,
  low_stock_threshold: 2,
  is_active: true,
  created_at: '',
  updated_at: '',
};
describe('ProductDetail', () => {
  it('refreshes history and forwards the updated balance after a restock', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ProductDetail product={product} layout="stacked" onSaved={onSaved} />);
    expect(screen.getByRole('heading', { name: 'Coffee' })).toBeInTheDocument();
    expect(screen.getByText('History p1: 0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Record restock' }));
    expect(onSaved).toHaveBeenCalledWith({ ...product, on_hand: 12 });
    expect(screen.getByText('History p1: 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archive fixture product' }));
    expect(onSaved).toHaveBeenLastCalledWith({ ...product, is_active: false });
  });
  it('exposes edit and history in mobile tabs', async () => {
    const user = userEvent.setup();
    render(<ProductDetail product={product} layout="tabs" onSaved={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Record restock' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Archive fixture product' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByText('History p1: 0')).toBeInTheDocument();
  });
});
