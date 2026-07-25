// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { routerPush, routerRefresh, getUserMock, updateUserMock } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: getUserMock, updateUser: updateUserMock } }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

import { ResetPasswordForm } from './reset-password-form';

afterEach(() => cleanup());

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue({ error: null });
  });

  it('shows the expired-link state when there is no recovery session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    render(<ResetPasswordForm />);
    expect(await screen.findByText('This link has expired')).toBeTruthy();
  });

  it('shows the password form when a recovery session exists', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    render(<ResetPasswordForm />);
    expect(await screen.findByLabelText('New password')).toBeTruthy();
  });

  it('shows an error and does not call updateUser when passwords do not match', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await screen.findByLabelText('New password');
    await user.type(screen.getByLabelText('New password'), 'hunter22');
    await user.type(screen.getByLabelText('Confirm new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveProperty('textContent', 'Passwords do not match');
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('updates the password and redirects to dashboard on success', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await screen.findByLabelText('New password');
    await user.type(screen.getByLabelText('New password'), 'hunter22');
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: 'hunter22' }));
    expect(routerPush).toHaveBeenCalledWith('/dashboard');
    expect(routerRefresh).toHaveBeenCalled();
  });

  it('shows a toast when updateUser returns an error', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    updateUserMock.mockResolvedValueOnce({ error: { message: 'Password too weak' } });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await screen.findByLabelText('New password');
    await user.type(screen.getByLabelText('New password'), 'hunter22');
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Password too weak'));
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows a generic toast when updateUser throws instead of returning an error', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } } });
    updateUserMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);
    await screen.findByLabelText('New password');
    await user.type(screen.getByLabelText('New password'), 'hunter22');
    await user.type(screen.getByLabelText('Confirm new password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    );
    expect(routerPush).not.toHaveBeenCalled();
  });
});
