// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Stat } from './stat';

describe('Stat', () => {
  it('renders a string value', () => {
    render(<Stat label="Vendors" value="42" />);
    expect(screen.getByText('Vendors')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a number value coerced to a string, with font-mono', () => {
    render(<Stat label="Products" value={128} />);
    expect(screen.getByText('128')).toHaveClass('font-mono');
  });
});
