// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({
  saveProduct: vi.fn(async () => ({ success: true, productId: 'p1' })),
  deleteProduct: vi.fn(async () => ({ success: true })),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ProductForm } from './product-form';

// jsdom has no ResizeObserver — the Switch primitive (Radix) needs one to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

afterEach(() => cleanup());

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
});
