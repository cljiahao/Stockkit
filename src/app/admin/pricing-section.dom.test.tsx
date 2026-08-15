// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setPricingMock, refreshMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  setPricingMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('./actions', () => ({ setPricing: setPricingMock }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));

import { PricingSection } from './pricing-section';

beforeEach(() => {
  setPricingMock.mockReset();
  refreshMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
});

describe('PricingSection', () => {
  it('renders the form pre-filled from the initial price', () => {
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    expect(screen.getByLabelText(/monthly \(sgd\)/i)).toHaveValue('19.99');
  });

  it('saves, toasts success, and refreshes on a successful save', async () => {
    setPricingMock.mockResolvedValue({ success: true });
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    fireEvent.change(screen.getByLabelText(/monthly \(sgd\)/i), { target: { value: '24.99' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(setPricingMock).toHaveBeenCalledWith({ monthly_cents: 2499 }));
    expect(toastSuccessMock).toHaveBeenCalledWith('Pricing updated');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('toasts the server error, once, when setPricing returns a failure', async () => {
    setPricingMock.mockResolvedValue({ success: false, error: 'Could not update pricing' });
    render(<PricingSection initial={{ monthly_cents: 1999, currency: 'SGD' }} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('Could not update pricing'));
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
