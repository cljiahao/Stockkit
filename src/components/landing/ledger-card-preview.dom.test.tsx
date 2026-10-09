// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LedgerCardPreview } from './ledger-card-preview';

describe('LedgerCardPreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders the mock product name, on-hand count, unit cost, and a recent movement', () => {
    render(<LedgerCardPreview />);
    expect(screen.getByText('Whole Bean Coffee 1kg')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('$18.50')).toBeTruthy();
    expect(screen.getByText('+12 restock')).toBeTruthy();
  });

  it('rotates to the next sample activity row on its 4s interval', () => {
    vi.useFakeTimers();
    render(<LedgerCardPreview />);
    expect(screen.getByText('+12 restock')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText('−3 waste')).toBeTruthy();

    vi.useRealTimers();
  });

  it('skips the activity-rotation interval under prefers-reduced-motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    );
    render(<LedgerCardPreview />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText('+12 restock')).toBeTruthy();
    expect(screen.queryByText('−3 waste')).not.toBeInTheDocument();
  });
});
