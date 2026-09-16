// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  LegalDocument: vi.fn((props: { doc: string; kit?: string }) => (
    <div data-testid="legal-document" data-kit={props.kit}>
      {props.doc}
    </div>
  )),
}));

vi.mock('@merqo/ui', () => ({ LegalDocument: mocks.LegalDocument }));

import TermsPage from './page';

describe('TermsPage', () => {
  it('renders @merqo/ui\'s LegalDocument with doc="terms" kit="stockkit"', () => {
    const { getByTestId } = render(<TermsPage />);

    const doc = getByTestId('legal-document');
    expect(doc).toHaveTextContent('terms');
    expect(doc).toHaveAttribute('data-kit', 'stockkit');
  });
});
