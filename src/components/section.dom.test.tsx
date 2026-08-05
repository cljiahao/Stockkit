// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Section } from './section';

describe('Section', () => {
  it("renders inside stockkit's own ElevatedCard shell, not the shared default section shell", () => {
    const { container } = render(
      <Section icon={<span />} title="Stall name" description="desc">
        <p>content</p>
      </Section>
    );
    // ElevatedCard's distinguishing marker: rounded-[20px]. The shared
    // Section's own default shell (bg-card border shadow-sm, no wrapper)
    // must NOT apply once a wrapper is supplied.
    const shell = container.querySelector('.rounded-\\[20px\\]');
    expect(shell).not.toBeNull();
    expect(shell?.className).not.toMatch(/shadow-sm\b/);
  });

  it('renders the icon, title, and description via the shared Section header', () => {
    render(
      <Section icon={<span data-testid="my-icon" />} title="Stall name" description="desc">
        <p>content</p>
      </Section>
    );
    expect(screen.getByTestId('my-icon')).toBeTruthy();
    expect(screen.getByText('Stall name')).toBeTruthy();
    expect(screen.getByText('desc')).toBeTruthy();
  });

  it('renders an eyebrow when given one', () => {
    render(
      <Section icon={<span />} eyebrow="Shown to customers" title="Stall name" description="desc">
        <p>content</p>
      </Section>
    );
    expect(screen.getByText('Shown to customers')).toBeTruthy();
  });

  it('renders children inside the shell', () => {
    render(
      <Section icon={<span />} title="Stall name" description="desc">
        <p>field content</p>
      </Section>
    );
    expect(screen.getByText('field content')).toBeTruthy();
  });
});
