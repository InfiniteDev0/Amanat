import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/**
 * False during the server render and the first client render, true after.
 * For text the server can't reproduce exactly, like Intl country and currency
 * names (Node and the browser ship different translations, e.g. in Somali).
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
