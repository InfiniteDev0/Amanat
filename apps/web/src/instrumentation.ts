import * as Sentry from '@sentry/nextjs';

import { sentryOptions } from '@/lib/sentry-options';

// The server side of Sentry: Next calls register() once per server runtime
// (Node, and the edge one proxy.ts runs in).
export function register() {
  Sentry.init(sentryOptions);
}

/** Errors thrown while rendering a page or running a route handler. */
export const onRequestError = Sentry.captureRequestError;
