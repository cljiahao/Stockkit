// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GlobalError from './global-error';

afterEach(() => cleanup());

describe('GlobalError', () => {
  it('calls reset when "Try again" is clicked', async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });

    render(<GlobalError error={error} reset={reset} />);
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });
});
