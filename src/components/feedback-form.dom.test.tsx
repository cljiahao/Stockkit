// @vitest-environment jsdom
import type { ActionResult } from '@/lib/action-result';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedbackForm } from './feedback-form';

const submitFeedbackAction = vi.fn(async (_input: unknown): Promise<ActionResult> => ({
  success: true,
}));
vi.mock('@/app/actions/feedback', () => ({
  submitFeedbackAction: (input: unknown) => submitFeedbackAction(input),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

afterEach(() => cleanup());

describe('FeedbackForm', () => {
  it('requires a score before sending', async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(submitFeedbackAction).not.toHaveBeenCalled();
  });

  it('sends feedback and shows the thank-you state on success', async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByText(/thanks for the feedback/i)).toBeTruthy();
  });

  it('shows a toast when the action returns a failure', async () => {
    submitFeedbackAction.mockResolvedValueOnce({ success: false, error: 'Server error' });
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByText(/send feedback/i)).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Server error');
  });

  it('shows a generic toast when the action throws instead of returning an error', async () => {
    submitFeedbackAction.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByText(/send feedback/i)).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });
});
