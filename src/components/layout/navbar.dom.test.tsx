// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Navbar } from './navbar';

describe('Navbar', () => {
  it('shows Sign in and Get started when signed out', () => {
    render(<Navbar />);
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'Get started' }).getAttribute('href')).toBe(
      '/login?mode=signup'
    );
  });

  it('shows Dashboard when signed in', () => {
    render(<Navbar authed />);
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
  });
});
