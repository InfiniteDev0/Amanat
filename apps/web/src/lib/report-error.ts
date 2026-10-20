/**
 * Where errors the user shouldn't see in detail go: the real error, for us to
 * read, while the screen shows a plain translated message. Sentry plugs in
 * here when it's set up (Phase 1h); until then it's the browser console.
 */
export function reportError(error: unknown, context: Record<string, unknown> = {}): void {
  console.error('[amanat]', error, context);
}
