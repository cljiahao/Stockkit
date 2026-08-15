// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ActionResult } from '@/lib/action-result';
import { DashboardNav } from './dashboard-nav';

// No live Supabase project is configured in this environment (see AGENTS.md);
// `publicEnv` throws fast on missing env vars at *import* time, not just when
// a client is constructed — so isolate the client-side sign-out call the same
// way profile-form.dom.test.tsx isolates its own server actions.
const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async (): Promise<{ error: null | { message: string } }> => ({ error: null })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

const { submitFeedbackActionMock } = vi.hoisted(() => ({
  submitFeedbackActionMock: vi.fn(async (_input: unknown): Promise<ActionResult> => ({
    success: true,
  })),
}));
vi.mock('@/app/actions/feedback', () => ({
  submitFeedbackAction: submitFeedbackActionMock,
}));

const { submitSupportMessageActionMock } = vi.hoisted(() => ({
  submitSupportMessageActionMock: vi.fn(async (_input: unknown): Promise<ActionResult> => ({
    success: true,
  })),
}));
vi.mock('@/app/actions/support', () => ({
  submitSupportMessageAction: submitSupportMessageActionMock,
}));

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/dashboard') }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathnameMock(),
}));

afterEach(() => {
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
  submitFeedbackActionMock.mockReset();
  submitFeedbackActionMock.mockResolvedValue({ success: true });
  submitSupportMessageActionMock.mockReset();
  submitSupportMessageActionMock.mockResolvedValue({ success: true });
  pathnameMock.mockReturnValue('/dashboard');
});

describe('DashboardNav', () => {
  it('renders exactly one sticky <header>, not nested inside another', () => {
    // Regression test for the qkit migration's nested-<header> bug: the
    // dashboard layout used to wrap this component in its own <header>;
    // @merqo/ui's DashboardNav renders its own internal <header>, so a
    // second wrapping <header> would nest two and break `position: sticky`.
    const { container } = render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    const headers = container.querySelectorAll('header');
    expect(headers).toHaveLength(1);
    expect(headers[0].className).toMatch(/sticky/);
    expect(headers[0].className).toMatch(/backdrop-blur-md/);
  });

  it('shows the wordmark linking to /dashboard', () => {
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    const wordmark = screen.getByRole('link', { name: 'StockKit' });
    expect(wordmark).toHaveAttribute('href', '/dashboard');
  });

  it('shows inline Overview and Products nav links', () => {
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute(
      'href',
      '/dashboard/products'
    );
  });

  it('highlights Products as active when on a products route', () => {
    pathnameMock.mockReturnValue('/dashboard/products');
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    const productsLink = screen.getByRole('link', { name: 'Products' });
    expect(productsLink.className).toMatch(/text-primary/);
  });

  it('shows the real vendor name in the account trigger, not a static label', () => {
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    const trigger = screen.getByRole('button', { name: /account menu/i });
    expect(within(trigger).getByText('Ah Huat Chicken Rice')).toBeTruthy();
  });

  it('has data-tour="nav-account" on the account trigger and "nav-menu" on the burger', () => {
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveAttribute(
      'data-tour',
      'nav-account'
    );
    expect(screen.getByRole('button', { name: /mobile navigation menu/i })).toHaveAttribute(
      'data-tour',
      'nav-menu'
    );
  });

  it('signs out, and navigates to /login, on success', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });

  it('shows an inline error when sign-out returns a Supabase error', async () => {
    signOutMock.mockResolvedValueOnce({ error: { message: 'Session already expired' } });
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(await screen.findByText('Session already expired')).toBeTruthy();
  });

  it('submits feedback via submitFeedbackAction with {nps, message}, adapting the {success,error} result to a thrown error on failure', async () => {
    submitFeedbackActionMock.mockResolvedValueOnce({ success: false, error: 'Server error' });
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /feedback/i }));

    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.type(screen.getByLabelText(/message/i), 'Great app');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() =>
      expect(submitFeedbackActionMock).toHaveBeenCalledWith({ nps: 9, message: 'Great app' })
    );
    expect(await screen.findByText('Server error')).toBeTruthy();
  });

  it('submits a support request via submitSupportMessageAction with {category, body}', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /get help/i }));

    await user.click(screen.getByRole('radio', { name: /account/i }));
    await user.type(screen.getByLabelText(/message/i), "Can't sign in.");
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() =>
      expect(submitSupportMessageActionMock).toHaveBeenCalledWith({
        category: 'account',
        body: "Can't sign in.",
      })
    );
  });

  it('account menu has Profile, Plan, Get help, Feedback, then Sign out', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems.map((item) => item.textContent)).toEqual([
      'Profile',
      'Plan',
      'Get help',
      'Feedback',
      'Sign out',
    ]);
  });

  it('has a burger button hidden at sm and up', () => {
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    const burger = screen.getByRole('button', { name: /mobile navigation menu/i });
    expect(burger.className).toMatch(/sm:hidden/);
  });

  it('accepts an avatarUrl prop without crashing (jsdom cannot exercise the real image-load path)', () => {
    render(
      <DashboardNav
        vendorName="Ah Huat Chicken Rice"
        avatarUrl="https://x.supabase.co/avatar.png"
      />
    );
    expect(screen.getByRole('button', { name: /account menu/i })).toBeTruthy();
  });

  it('opens the mobile links panel from the burger', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="Ah Huat Chicken Rice" />);
    await user.click(screen.getByRole('button', { name: /mobile navigation menu/i }));
    const links = screen.getAllByRole('link', { name: 'Products' });
    expect(links).toHaveLength(2);
  });
});
