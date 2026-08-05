'use client';

import { navigatingAway, useAsyncAction as useSharedAsyncAction } from '@merqo/ui';

/**
 * A `pending` flag for an async handler that ALWAYS resets — even if the handler
 * throws (a server action rejecting on a network error). Replaces the hand-rolled
 * `setBusy(true) … await … setBusy(false)` pattern, several copies of which left
 * the button stuck-disabled on a throw (the reset never ran).
 *
 *   const { pending, run } = useAsyncAction();
 *   <Button disabled={pending} onClick={() => run(async () => { … })} />
 *
 * Thin adapter over `@merqo/ui`'s `useAsyncAction`, which binds ONE action at
 * hook-creation time. Binding it here to "call whatever closure you're
 * given" reproduces this hook's original per-call-dynamic-closure shape
 * exactly, so every existing call site (`run(async () => { … })`, several of
 * which live in business-logic forms out of scope for this migration) keeps
 * working completely unchanged.
 */
export function useAsyncAction(): {
  pending: boolean;
  error: unknown;
  run: (fn: () => Promise<void>) => Promise<void>;
  reset: () => void;
} {
  return useSharedAsyncAction((fn: () => Promise<void>) => fn());
}

export { navigatingAway };
