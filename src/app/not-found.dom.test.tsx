// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import NotFound from './not-found';

afterEach(() => cleanup());

describe('NotFound', () => {
  it('links back to home', () => {
    render(<NotFound />);
    expect(screen.getByRole('link', { name: /back to start/i }).getAttribute('href')).toBe('/');
  });
});
