// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routerPush, routerRefresh, searchParamsValue, completeSignupMock, authMock } = vi.hoisted(
  () => ({
    routerPush: vi.fn(),
    routerRefresh: vi.fn(),
    searchParamsValue: { current: '' },
    completeSignupMock: vi.fn(),
    authMock: {
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  })
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  useSearchParams: () => new URLSearchParams(searchParamsValue.current),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: authMock }),
}));

vi.mock('./actions', () => ({
  completeSignup: completeSignupMock,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

import { LoginForm } from './login-form';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsValue.current = '';
    authMock.signInWithOAuth.mockResolvedValue({ error: null });
    authMock.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    authMock.signInWithPassword.mockResolvedValue({ error: null });
    authMock.resetPasswordForEmail.mockResolvedValue({ error: null });
    completeSignupMock.mockResolvedValue({ success: true });
  });

  it('renders the sign-in form by default', () => {
    render(<LoginForm />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('starts in signup mode when the mode search param is signup', () => {
    searchParamsValue.current = 'mode=signup';
    render(<LoginForm />);
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeTruthy();
    expect(screen.getByLabelText('Stall / business name')).toBeTruthy();
  });

  it('calls signInWithOAuth when Continue with Google is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: expect.stringContaining('/auth/callback') },
    });
  });

  it('shows a toast when Google sign-in fails to start', async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: { message: 'OAuth unavailable' } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('OAuth unavailable'));
  });

  it('shows a generic toast when Google sign-in throws instead of returning an error', async () => {
    authMock.signInWithOAuth.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    );
  });

  it('rejects signup without a stall name before calling signUp', async () => {
    searchParamsValue.current = 'mode=signup';
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(authMock.signUp).not.toHaveBeenCalled();
  });

  it('signs up, completes vendor setup, and redirects when a session is returned immediately', async () => {
    searchParamsValue.current = 'mode=signup';
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Stall / business name'), "Mama's Kitchen");
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(completeSignupMock).toHaveBeenCalledWith("Mama's Kitchen"));
    expect(routerPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the check-your-email signup state when signUp returns no session', async () => {
    authMock.signUp.mockResolvedValue({ data: { session: null }, error: null });
    searchParamsValue.current = 'mode=signup';
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Stall / business name'), "Mama's Kitchen");
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/confirmation link/)).toBeTruthy();
  });

  it('shows a toast when signUp returns an error', async () => {
    authMock.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'Email taken' },
    });
    searchParamsValue.current = 'mode=signup';
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Stall / business name'), "Mama's Kitchen");
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Email taken'));
    expect(completeSignupMock).not.toHaveBeenCalled();
  });

  it('signs in with email/password and redirects to dashboard on success', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(authMock.signInWithPassword).toHaveBeenCalledWith({
        email: 'vendor@example.com',
        password: 'hunter22',
      })
    );
    expect(routerPush).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a generic toast when sign-in throws instead of returning an error', async () => {
    authMock.signInWithPassword.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.type(screen.getByLabelText('Password'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows a toast when sign-in fails', async () => {
    authMock.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid credentials' } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'));
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('shows a toast and does not send when Forgot password is clicked with no email', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Enter your email first'));
    expect(authMock.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sends a password-reset email and shows the check-your-email reset state', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    await waitFor(() =>
      expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith('vendor@example.com', {
        redirectTo: expect.stringContaining('/auth/callback?next=/reset-password'),
      })
    );
    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText(/password reset link/)).toBeTruthy();
  });

  it('shows a toast when the reset email send returns an error', async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Rate limited' } });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Rate limited'));
    expect(screen.queryByText('Check your email')).toBeNull();
  });

  it('shows a generic toast when the reset email send throws instead of returning an error', async () => {
    authMock.resetPasswordForEmail.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.')
    );
  });

  it('returns to sign-in from the check-your-email state', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'vendor@example.com');
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await screen.findByText('Check your email');

    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeTruthy();
  });
});
