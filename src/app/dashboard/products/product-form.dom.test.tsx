// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';

const { saveProductMock, deleteProductMock } = vi.hoisted(() => ({
  saveProductMock: vi.fn(async (): Promise<ActionResult<{ productId: string }>> => ({
    success: true,
    productId: 'p1',
  })),
  deleteProductMock: vi.fn(async (): Promise<ActionResult> => ({ success: true })),
}));
vi.mock('./actions', () => ({
  saveProduct: saveProductMock,
  deleteProduct: deleteProductMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

import { ProductForm } from './product-form';

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

afterEach(() => {
  saveProductMock.mockReset();
  saveProductMock.mockResolvedValue({ success: true, productId: 'p1' });
  deleteProductMock.mockReset();
  deleteProductMock.mockResolvedValue({ success: true });
});

describe('ProductForm', () => {
  it('shows an inline error and marks the field invalid on an unparseable unit cost', async () => {
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Chicken thigh');
    const costInput = screen.getByLabelText(/unit cost/i);
    await user.clear(costInput);
    await user.type(costInput, '-5');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(screen.getByText('Enter a valid unit cost')).toBeTruthy();
    expect(costInput.getAttribute('aria-invalid')).toBe('true');

    await user.clear(costInput);
    await user.type(costInput, '5.00');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(screen.queryByText('Enter a valid unit cost')).toBeNull();
    expect(costInput.getAttribute('aria-invalid')).toBe('false');
  });

  it('saves a new product and reports it to onSaved', async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<ProductForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Chicken thigh');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(saveProductMock).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chicken thigh' }));
  });

  it('shows a toast when saving returns a failure', async () => {
    saveProductMock.mockResolvedValueOnce({ success: false, error: 'Server error' });
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Chicken thigh');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('shows a generic toast when saving throws instead of returning an error', async () => {
    saveProductMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^name$/i), 'Chicken thigh');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('shows a generic toast when deleting throws instead of returning an error', async () => {
    deleteProductMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ProductForm product={product} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /delete product/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /delete product/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('deletes a product and calls onDeleted', async () => {
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<ProductForm product={product} onSaved={vi.fn()} onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: /delete product/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /delete product/i }));

    expect(onDeleted).toHaveBeenCalled();
  });

  it('shows a toast when deleting returns a failure', async () => {
    deleteProductMock.mockResolvedValueOnce({ success: false, error: 'Cannot delete' });
    const user = userEvent.setup();
    render(<ProductForm product={product} onSaved={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /delete product/i }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /delete product/i }));

    expect(toast.error).toHaveBeenCalledWith('Cannot delete');
  });

  it('picks a preset unit from the combobox', async () => {
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} />);

    // The trigger's accessible name is always "Unit" (from its <label for>
    // association, per the button-is-labelable HTML rule) regardless of the
    // selected value, so assert on textContent instead of accessible name.
    const trigger = screen.getByRole('combobox', { name: /^unit$/i });
    await user.click(trigger);
    // cmdk filters CommandItems against the search input's current value —
    // it starts pre-filled with the field's own value ('unit'), which hides
    // every other preset until the search is cleared.
    await user.clear(screen.getByPlaceholderText(/search or enter a unit/i));
    await user.click(await screen.findByRole('option', { name: 'box' }));

    expect(trigger).toHaveTextContent('box');
  });

  it('offers and selects a custom unit not in the preset list', async () => {
    const user = userEvent.setup();
    render(<ProductForm onSaved={vi.fn()} />);

    const trigger = screen.getByRole('combobox', { name: /^unit$/i });
    await user.click(trigger);
    const search = screen.getByPlaceholderText(/search or enter a unit/i);
    await user.clear(search);
    await user.type(search, 'crate');

    // Curly quotes (&ldquo;/&rdquo;), not straight ASCII quotes, per the
    // component's actual markup.
    const custom = await screen.findByRole('option', { name: 'Use “crate”' });
    await user.click(custom);

    expect(trigger).toHaveTextContent('crate');
  });
});
