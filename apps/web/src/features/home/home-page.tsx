'use client';

import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { AppFrame } from '@/components/layout/workspace-frame';
import { LoadingScreen } from '@/features/auth/session-gate';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';

import { Greeting } from './home-header';
import { ShopActions } from './shop-actions';
import { YourShops } from './your-shops';

/**
 * Home (/home), like the M-Pesa app: you at the top-left, a greeting, your
 * shops as cards (★ on the main one, what's in each), and the everyday
 * actions under them, recording into the main shop unless you pick another.
 * With no shop yet the setup wizard is open over the page instead.
 *
 * The page sits in the main shop's context: the greeting's clock, the
 * activity log and the bell work from it.
 */
export function HomePage() {
  const shops = useMyWorkspaces();
  if (shops.isPending) return <LoadingScreen />;
  const list = shops.data ?? [];
  const main = list.find((m) => m.workspace.isMain) ?? list[0];
  if (!main) return null;

  return (
    <WorkspaceProvider workspace={main.workspace} role={main.role}>
      <AppFrame title={<PageBreadcrumb />} workspaceId={main.workspace.id}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pt-12 pb-16">
          <header className="flex justify-center">
            <Greeting />
          </header>
          <YourShops shops={list} main={main.workspace} />
          <ShopActions shops={list} defaultShopId={main.workspace.id} />
        </div>
      </AppFrame>
    </WorkspaceProvider>
  );
}
