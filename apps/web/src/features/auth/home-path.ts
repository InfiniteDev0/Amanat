'use client';

import { needsProfile, type User } from '@sarrif/core';
import type { QueryClient } from '@tanstack/react-query';

import { getLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

import { returnPath } from './return-path';

/**
 * Where a signed-in person belongs:
 * - no shop yet → All shops (empty), where the setup wizard opens on top
 *   (its first step asks for the phone, and the terms if missing)
 * - in a shop but no phone or terms yet (invited) → Complete your profile
 * - otherwise → the shop they used last, or their first shop.
 *
 * There is no onboarding page: setup is an overlay in the app layout
 * (features/onboarding/setup-wizard.tsx) that opens for anyone with no shop.
 */
export async function homePathFor(user: User, queryClient: QueryClient): Promise<string> {
  const memberships = await queryClient.fetchQuery({
    queryKey: queryKeys.workspaces,
    queryFn: () => api.workspaces.listMine(),
  });
  if (memberships.length === 0) return '/all-shops';
  if (needsProfile(user)) return '/complete-profile';
  const lastId = getLastWorkspaceId();
  const target = memberships.find((m) => m.workspace.id === lastId) ?? memberships[0]!;
  return `/w/${target.workspace.id}`;
}

/**
 * After signing in: back to the page they were on when the session ended
 * (?next=, only an app page), unless something comes first (setting up a
 * shop, completing the profile).
 */
export async function destinationFor(user: User, queryClient: QueryClient): Promise<string> {
  const home = await homePathFor(user, queryClient);
  if (home === '/all-shops' || home === '/complete-profile') return home;
  return returnPath() ?? home;
}
