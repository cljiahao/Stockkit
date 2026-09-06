// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './site-footer';

describe('SiteFooter', () => {
  it('renders the Terms and Privacy legal links', () => {
    render(<SiteFooter />);

    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/legal/terms');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/legal/privacy');
  });

  it('still shows the sign-in link when showSignIn is set, alongside the legal links', () => {
    render(<SiteFooter showSignIn />);

    expect(screen.getByRole('link', { name: 'Vendor sign in →' })).toHaveAttribute(
      'href',
      '/login'
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/legal/terms');
  });

  it('links to the About page', () => {
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  });
});
