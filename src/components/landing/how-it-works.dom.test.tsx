// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HowItWorks } from './how-it-works';

describe('HowItWorks', () => {
  it('renders all three steps in order', () => {
    render(<HowItWorks />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Add your products',
      'Log stock in and out',
      'Watch your numbers',
    ]);
  });
});
