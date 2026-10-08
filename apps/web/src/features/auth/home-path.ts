'use client';

import type { User } from '@sarrif/core';
import type { QueryClient } from '@tanstack/react-query';

import { getLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/**
 * Where a signed-in person belongs:
 * - no shop yet → All shops (empty), where the setup wizard opens on top
 * - otherwise → the shop they used last, or their first shop.
 *
 * There is no onboarding page: setup is an overlay in the app layout
 * (features/onboarding/setup-wizard.tsx) that opens for anyone with no shop.
 *
 * An invite link will slot in here later: an invited person joins that shop
 * and never sees shop setup.
 */
export async function homePathFor(user: User, queryClient: QueryClient): Promise<string> {
  const memberships = await queryClient.fetchQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => api.workspaces.listMine(),
  });
  if (memberships.length === 0) return '/all-shops';
  const lastId = getLastWorkspaceId();
  const target = memberships.find((m) => m.workspace.id === lastId) ?? memberships[0]!;
  return `/w/${target.workspace.id}`;
}
