// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ErrorPage from './error';

afterEach(() => cleanup());

describe('Error', () => {
  it('logs the error and calls reset when "Try again" is clicked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();
    const error = Object.assign(new Error('boom'), { digest: 'abc123' });

    render(<ErrorPage error={error} reset={reset} />);
    expect(consoleError).toHaveBeenCalledWith('Unhandled error', error);

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
