// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NotFound from './not-found';

describe('NotFound', () => {
  it('links back to home', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /back to start/i }).getAttribute('href')).toBe('/');
  });
});
