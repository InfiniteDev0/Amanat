'use client';

import { useState } from 'react';

import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { AppFrame } from '@/components/layout/workspace-frame';
import { FrameLoading } from '@/components/layout/frame-loading';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';

import { Greeting } from './home-header';
import { QuickActionsGrid } from './quick-actions-grid';
import { YourShops } from './your-shops';

/**
 * Home (/home), like the M-Pesa app: a greeting, your shops as cards you
 * swipe through (★ on the main one, the eye to hide the money, Open shop),
 * and Quick actions under them, which record into the shop on screen.
 * With no shop yet the setup wizard is open over the page instead.
 *
 * The page sits in the main shop's context: the greeting's clock, the
 * activity log and the bell work from it.
 */
export function HomePage() {
  const shops = useMyWorkspaces();
  const [shown, setShown] = useState<string | null>(null);
  if (shops.isPending) return <FrameLoading />;
  const list = shops.data ?? [];
  const main = list.find((m) => m.workspace.isMain) ?? list[0];
  if (!main) return null;
  const shownId = list.some((m) => m.workspace.id === shown) ? shown! : main.workspace.id;

  return (
    <WorkspaceProvider workspace={main.workspace} role={main.role}>
      <AppFrame title={<PageBreadcrumb />} workspaceId={main.workspace.id}>
        <div className="flex w-full flex-col gap-8 px-6 pt-10 pb-16">
          <header className="flex justify-center">
            <Greeting />
          </header>
          <YourShops shops={list} main={main.workspace} onShown={setShown} />
          <QuickActionsGrid shops={list} shopId={shownId} />
        </div>
      </AppFrame>
    </WorkspaceProvider>
  );
}
