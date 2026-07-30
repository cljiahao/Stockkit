// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportForm } from './support-form';

const { submitSupportMessageActionMock } = vi.hoisted(() => ({
  submitSupportMessageActionMock: vi.fn(),
}));

vi.mock('@/app/actions/support', () => ({
  submitSupportMessageAction: submitSupportMessageActionMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

beforeEach(() => {
  submitSupportMessageActionMock.mockReset();
});

describe('SupportForm', () => {
  it('shows an error and does not submit when the body is empty', async () => {
    const user = userEvent.setup();
    render(<SupportForm />);
    await user.click(screen.getByRole('button', { name: /send message/i }));
    expect(submitSupportMessageActionMock).not.toHaveBeenCalled();
  });

  it('submits the selected category and typed body, shows a sent confirmation', async () => {
    submitSupportMessageActionMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<SupportForm />);

    const form = screen.getByTestId('support-form');
    await user.click(screen.getByRole('radio', { name: /account/i }));
    await user.type(form.querySelector('textarea') as HTMLTextAreaElement, "Can't sign in.");
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(submitSupportMessageActionMock).toHaveBeenCalledWith({
        category: 'account',
        body: "Can't sign in.",
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/we'll look into this/i)).toBeTruthy();
    });
  });

  it('shows a toast when the action returns a failure', async () => {
    submitSupportMessageActionMock.mockResolvedValueOnce({ success: false, error: 'Server error' });
    const user = userEvent.setup();
    render(<SupportForm />);

    const form = screen.getByTestId('support-form');
    await user.type(form.querySelector('textarea') as HTMLTextAreaElement, "Can't sign in.");
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server error');
    });
  });

  it('shows a generic toast when the action throws instead of returning an error', async () => {
    submitSupportMessageActionMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<SupportForm />);

    const form = screen.getByTestId('support-form');
    await user.type(form.querySelector('textarea') as HTMLTextAreaElement, "Can't sign in.");
    await user.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
    });
  });
});
