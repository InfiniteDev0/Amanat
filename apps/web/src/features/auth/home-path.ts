'use client';

import type { QueryClient } from '@tanstack/react-query';

import { getLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

import { returnPath } from './return-path';

/**
 * Where a signed-in person belongs:
 * - setup not finished (no shop yet) → All shops, where the setup wizard
 *   opens on top (it asks for the phone, and the terms if missing)
 * - otherwise → the shop they used last, or their main shop.
 *
 * There is no onboarding page: setup is an overlay in the app layout
 * (features/onboarding/setup-wizard.tsx). The server agrees (core's routing
 * table, used by proxy.ts).
 */
export async function homePathFor(queryClient: QueryClient): Promise<string> {
  const memberships = await queryClient.fetchQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => api.workspaces.listMine(),
  });
  if (memberships.length === 0) return '/all-shops';
  const lastId = getLastWorkspaceId();
  const target = memberships.find((m) => m.workspace.id === lastId) ?? memberships[0]!;
  return `/w/${target.workspace.id}`;
}

/**
 * After signing in: back to the page they were on when the session ended
 * (?next=, only an app page), unless setup comes first.
 */
export async function destinationFor(queryClient: QueryClient): Promise<string> {
  const home = await homePathFor(queryClient);
  if (home === '/all-shops') return home;
  return returnPath() ?? home;
}
