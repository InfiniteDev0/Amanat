'use client';

import { useRef } from 'react';

import { useOnline } from '@/lib/use-online';

/**
 * For the auth forms: one request at a time, and none while offline. A
 * double tap (or Enter held down) sends one request, not two; the button is
 * also disabled, but a second event can arrive before React re-renders.
 *
 * `run(start)` calls `start(done)` only when nothing is in flight; `done`
 * must be called when the request settles.
 */
export function useSubmitGuard() {
  const online = useOnline();
  const inFlight = useRef(false);
  const run = (start: (done: () => void) => void) => {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    start(() => {
      inFlight.current = false;
    });
  };
  return { online, run };
}
