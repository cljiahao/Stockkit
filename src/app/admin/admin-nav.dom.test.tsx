// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/admin') }));
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

import { AdminNav } from './admin-nav';

describe('AdminNav', () => {
  it('highlights Overview when on the /admin root', () => {
    pathnameMock.mockReturnValue('/admin');
    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Vendors' })).not.toHaveClass('text-primary');
  });

  it('highlights Vendors on any /admin/vendors path, not just the exact root', () => {
    pathnameMock.mockReturnValue('/admin/vendors');
    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Vendors' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveClass('text-primary');
  });

  it('links each tab to its route', () => {
    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: 'Vendors' })).toHaveAttribute('href', '/admin/vendors');
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute(
      'href',
      '/admin/activity'
    );
  });

  it('highlights Activity on the /admin/activity path', () => {
    pathnameMock.mockReturnValue('/admin/activity');
    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Activity' })).toHaveClass('text-primary');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveClass('text-primary');
  });
});
