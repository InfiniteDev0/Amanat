import * as Sentry from '@sentry/nextjs';

/**
 * Where errors the user shouldn't see in detail go: the real error, for us to
 * read in Sentry, while the screen shows a plain translated message. Works on
 * the browser and the server (route handlers). Without a DSN (Sentry off) it
 * only reaches the console.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error('[amanat]', error, context);
  Sentry.captureException(error, { extra: context });
}
