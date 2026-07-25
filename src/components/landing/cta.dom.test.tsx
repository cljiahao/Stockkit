// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Cta } from './cta';

describe('Cta', () => {
  it('links Get started to signup when signed out', () => {
    render(<Cta />);
    const cta = screen.getByRole('link', { name: 'Get started' });
    expect(cta.getAttribute('href')).toBe('/login?mode=signup');
  });

  it('links to the dashboard when signed in', () => {
    render(<Cta authed />);
    const cta = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(cta.getAttribute('href')).toBe('/dashboard');
  });
});
