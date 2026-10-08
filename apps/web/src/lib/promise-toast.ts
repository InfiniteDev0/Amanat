import { gooeyToast, type GooeyPromiseData } from 'goey-toast';

/** Long enough to see "Sending…" before it turns into the result. */
const MIN_LOADING_MS = 900;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One gooey toast that follows a request: loading, then success or the error.
 * The loading state is held for at least MIN_LOADING_MS, otherwise a quick
 * answer makes it flash by unseen. Give every toast a description: that's
 * what makes it expand. Returns the (held) promise to chain on.
 */
export function promiseToast<T>(promise: Promise<T>, data: GooeyPromiseData<T>): Promise<T> {
  const held = Promise.allSettled([promise, wait(MIN_LOADING_MS)]).then(([result]) => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  gooeyToast.promise(held, data);
  return held;
}
