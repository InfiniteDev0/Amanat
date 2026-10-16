'use client';

import { useEffect } from 'react';

import { useRouter } from '@/i18n/navigation';

import { getLastWorkspaceId } from './last-workspace';
import { useMyWorkspaces } from './queries';

/**
 * Shows nothing, and goes to a shop as soon as the user has one: the last
 * used, or the first. A page with no content of its own (for now All shops,
 * where someone with no shop waits under the setup wizard) uses it, so
 * finishing setup never flashes a placeholder before Home.
 */
export function GoToShop() {
  const router = useRouter();
  const shops = useMyWorkspaces().data;

  useEffect(() => {
    if (!shops?.length) return;
    const lastId = getLastWorkspaceId();
    const target = shops.find(({ workspace }) => workspace.id === lastId) ?? shops[0]!;
    router.replace(`/w/${target.workspace.id}`);
  }, [shops, router]);

  return null;
}
