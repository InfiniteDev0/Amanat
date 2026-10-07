'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { TemporaryNav } from '@/components/layout/temporary-nav';
import { Splash } from '@/features/auth/session-gate';

import { setLastWorkspaceId } from './last-workspace';
import { useMyWorkspaces } from './queries';
import { WorkspaceProvider } from './workspace-context';

/**
 * Everything under /w/[workspaceId]: confirms the user is a member of the shop
 * in the URL, remembers it as the last shop, and hands the shop and role to
 * every screen below through WorkspaceProvider.
 */
export function WorkspaceShell({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const t = useTranslations('common');
  const memberships = useMyWorkspaces();
  const membership = memberships.data?.find((m) => m.workspace.id === workspaceId);

  useEffect(() => {
    if (membership) setLastWorkspaceId(workspaceId);
  }, [membership, workspaceId]);

  if (memberships.isPending) return <Splash>{t('loading')}</Splash>;
  if (!membership) return <Splash>{t('noAccess')}</Splash>;

  return (
    <WorkspaceProvider workspace={membership.workspace} role={membership.role}>
      <TemporaryNav memberships={memberships.data ?? []} />
      <main className="flex-1">{children}</main>
    </WorkspaceProvider>
  );
}
