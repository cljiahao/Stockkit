// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Loading from './loading';

afterEach(() => cleanup());

describe('Loading', () => {
  it('renders a centered spinner', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });
});
