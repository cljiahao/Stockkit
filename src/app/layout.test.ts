import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Fraunces: () => ({ variable: '--font-fraunces' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
  Lato: () => ({ variable: '--font-lato' }),
}));

const { metadata } = await import('./layout');

describe('root layout metadata', () => {
  it('sets the browser-tab title', () => {
    expect(metadata.title).toBe('Stockkit | Inventory Tracking');
  });
});
