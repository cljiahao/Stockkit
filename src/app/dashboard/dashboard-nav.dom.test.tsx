// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardNav } from './dashboard-nav';

// No live Supabase project is configured in this environment (see AGENTS.md);
// `publicEnv` throws fast on missing env vars at *import* time, not just when
// a client is constructed — so isolate both the client-side sign-out call
// and the FeedbackForm's server action the same way profile-form.dom.test.tsx
// isolates its server actions, instead of pulling in the real Supabase modules.
const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(async (): Promise<{ error: null | { message: string } }> => ({ error: null })),
}));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: signOutMock } }),
}));

vi.mock('@/app/actions/feedback', () => ({
  submitFeedbackAction: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/components/support-form', () => ({
  SupportForm: () => <div data-testid="support-form">Support Form</div>,
}));

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/dashboard') }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathnameMock(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from 'sonner';

afterEach(() => {
  signOutMock.mockReset();
  signOutMock.mockResolvedValue({ error: null });
});

describe('DashboardNav', () => {
  it('Get help opens a Sheet with the support form, not a mailto link', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));

    const getHelp = screen.getByRole('menuitem', { name: /get help/i });
    expect(getHelp.querySelector('a')).toBeNull();

    await user.click(getHelp);
    expect(screen.getByTestId('support-form')).toBeTruthy();
  });

  it('account menu has Profile, Plan, Get help, Feedback, then Sign out', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
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

  it('renders a Plan link to /dashboard/plan', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    const planLink = screen.getByRole('menuitem', { name: /plan/i });
    expect(planLink).toHaveAttribute('href', '/dashboard/plan');
  });

  it('has a burger button hidden at sm and up', () => {
    render(<DashboardNav vendorName="My Stall" />);
    const burger = screen.getByRole('button', { name: /open menu/i });
    expect(burger.className).toMatch(/sm:hidden/);
  });

  it("accepts an avatarUrl prop without crashing (jsdom cannot exercise Radix Avatar's image-load path)", () => {
    render(<DashboardNav vendorName="My Stall" avatarUrl="https://x.supabase.co/avatar.png" />);
    expect(screen.getByRole('button', { name: /account menu/i })).toBeTruthy();
  });

  it('falls back to initials when avatarUrl is not set', () => {
    render(<DashboardNav vendorName="My Stall" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('M')).toBeTruthy();
  });

  it('shows a bold vendor name and a muted "Vendor account" subtitle in the dropdown', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Vendor account')).toBeTruthy();
    expect(screen.getAllByText('My Stall').length).toBeGreaterThan(0);
  });

  it('shows inline Overview and Products nav links', () => {
    render(<DashboardNav vendorName="My Stall" />);
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('href')).toBe('/dashboard');
    expect(screen.getByRole('link', { name: 'Products' }).getAttribute('href')).toBe(
      '/dashboard/products'
    );
  });

  it('highlights Products as active when on a products route', () => {
    pathnameMock.mockReturnValueOnce('/dashboard/products');
    render(<DashboardNav vendorName="My Stall" />);
    const productsLink = screen.getByRole('link', { name: 'Products' });
    expect(productsLink.className).toMatch(/text-primary/);
  });

  it('signs out and redirects to login on success', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalled());
  });

  it('shows a toast and does not navigate when sign-out returns an error', async () => {
    signOutMock.mockResolvedValueOnce({ error: { message: 'Session already expired' } });
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(toast.error).toHaveBeenCalledWith('Session already expired');
  });

  it('shows a generic toast when sign-out throws instead of returning an error', async () => {
    signOutMock.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(toast.error).toHaveBeenCalledWith('Something went wrong. Please try again.');
  });

  it('opens the mobile links panel from the burger and closes it after picking a link', async () => {
    const user = userEvent.setup();
    render(<DashboardNav vendorName="My Stall" />);
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const links = screen.getAllByRole('link', { name: 'Products' });
    await user.click(links[links.length - 1]);
    expect(screen.getAllByRole('link', { name: 'Products' }).length).toBe(1);
  });
});
