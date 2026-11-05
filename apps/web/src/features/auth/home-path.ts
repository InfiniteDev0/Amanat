'use client';

import type { QueryClient } from '@tanstack/react-query';

import { returnPath } from './return-path';

/**
 * Where a signed-in person belongs: Home. With no shop yet the setup wizard
 * opens over it (features/onboarding/setup-wizard.tsx); there is no
 * onboarding page. The server agrees (core's routing table, in proxy.ts).
 *
 * Async, and given the query client, so callers stay the same if it ever
 * needs data to decide.
 */
export async function homePathFor(_queryClient: QueryClient): Promise<string> {
  return '/home';
}

/** After signing in: back to the page they were on when the session ended (?next=, only an app page), else Home. */
export async function destinationFor(queryClient: QueryClient): Promise<string> {
  return returnPath() ?? homePathFor(queryClient);
}
