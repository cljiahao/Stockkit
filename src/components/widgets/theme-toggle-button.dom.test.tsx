// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { beforeAll, describe, expect, it } from 'vitest';

import { ThemeToggleButton } from './theme-toggle-button';

describe('ThemeToggleButton', () => {
  beforeAll(() => {
    // jsdom doesn't implement matchMedia; next-themes' ThemeProvider always
    // subscribes to it (system-preference listener), even with
    // enableSystem={false}, so real ThemeProvider tests need a stand-in.
    window.matchMedia ??= ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  it('toggles the documentElement class between light and dark on click', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <ThemeToggleButton />
      </ThemeProvider>
    );

    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('renders without a ThemeProvider ancestor', () => {
    render(<ThemeToggleButton />);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });
});
