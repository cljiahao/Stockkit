// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AboutPage from './page';

describe('AboutPage', () => {
  it('renders the Merqo origin story naming stockkit', () => {
    render(<AboutPage />);
    expect(screen.getByText('Why Merqo')).toBeInTheDocument();
    expect(screen.getByText(/wedding, in the queue for a coffee cart/)).toBeInTheDocument();
    expect(screen.getByText(/reading this on stockkit/)).toBeInTheDocument();
  });

  it('links the CTA back to stockkit', () => {
    render(<AboutPage />);
    expect(screen.getByRole('link', { name: 'See stockkit' })).toHaveAttribute('href', '/');
  });
});
