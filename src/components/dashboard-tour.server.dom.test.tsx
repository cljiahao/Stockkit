// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardTourServer } from './dashboard-tour.server';
vi.mock('./dashboard-tour', () => ({
  DashboardTour: ({ seen, exampleIndicator }: { seen: boolean; exampleIndicator: string }) => (
    <p data-testid="example">
      {String(seen)}:{exampleIndicator}
    </p>
  ),
}));
describe('DashboardTourServer', () => {
  it('serializes the canonical low-stock example for the client', () => {
    render(<DashboardTourServer seen={true} />);
    expect(screen.getByTestId('example')).toHaveTextContent('true:');
    expect(screen.getByTestId('example')).toHaveTextContent('bg-stock-low');
    expect(screen.getByTestId('example')).toHaveTextContent('Low');
  });
});
