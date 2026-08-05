// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { navigatingAway, useAsyncAction } from './use-async-action';

describe('useAsyncAction', () => {
  it('flips pending true then false around a successful run', async () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.pending).toBe(false);

    let resolveFn!: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(() => pendingPromise);
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolveFn();
      await runPromise;
    });
    expect(result.current.pending).toBe(false);
  });

  it('resets pending to false even when the handler throws, and re-throws', async () => {
    const { result } = renderHook(() => useAsyncAction());
    const err = new Error('boom');

    await expect(
      act(async () => {
        await result.current.run(() => Promise.reject(err));
      })
    ).rejects.toThrow('boom');

    expect(result.current.pending).toBe(false);
  });

  it('dispatches whatever closure is passed to a given run() call, per call', async () => {
    const { result } = renderHook(() => useAsyncAction());
    const calls: string[] = [];

    await act(async () => {
      await result.current.run(async () => {
        calls.push('first');
      });
    });
    await act(async () => {
      await result.current.run(async () => {
        calls.push('second');
      });
    });

    expect(calls).toEqual(['first', 'second']);
  });

  it('exposes error, set on failure and cleared by reset', async () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.run(() => Promise.reject(new Error('boom'))).catch(() => {});
    });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));

    act(() => {
      result.current.reset();
    });
    expect(result.current.error).toBeNull();
  });
});

describe('navigatingAway', () => {
  it('returns a promise that never resolves', async () => {
    const promise = navigatingAway();
    const race = await Promise.race([
      promise.then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 20)),
    ]);
    expect(race).toBe('timeout');
  });
});
