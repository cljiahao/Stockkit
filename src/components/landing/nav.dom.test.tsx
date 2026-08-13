// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Nav } from './nav';

describe('Nav', () => {
  it('shows Sign in and Get started when signed out', () => {
    render(<Nav />);
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe(
      '/login?mode=signup'
    );
  });

  it('shows Dashboard when signed in', () => {
    render(<Nav authed />);
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
  });

  it('renders the theme toggle, the only reachable spot for it in the app', () => {
    render(<Nav />);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });
});
