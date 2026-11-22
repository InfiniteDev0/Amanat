'use client';

import { businessDate, type CurrencyCode, type WorkspaceMembership } from '@sarrif/core';
import { type ReactNode, Suspense, useState } from 'react';

import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { AppFrame } from '@/components/layout/workspace-frame';
import { FrameLoading } from '@/components/layout/frame-loading';
import { RateChip } from '@/features/rates/rate-chip';
import { RatesDialog } from '@/features/rates/rates-dialog';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { inScope, useShopScope } from '@/features/workspaces/shop-scope';
import { useWorkspace as useWorkspaceShop, WorkspaceProvider } from '@/features/workspaces/workspace-context';

import { Greeting } from './home-header';
import { useDaySummary } from './queries';
import { QuickActionsGrid } from './quick-actions-grid';
import { RatesBanner } from './rates-section';
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
  const scope = useShopScope();
  const [shown, setShown] = useState<string | null>(null);
  if (shops.isPending) return <FrameLoading />;
  const all = shops.data ?? [];
  const main = all.find((m) => m.workspace.isMain) ?? all[0];
  if (!main) return null;
  // The shop picked in the sidebar's switcher, or every shop.
  const list = inScope(all, scope);
  const shownId = list.some((m) => m.workspace.id === shown) ? shown! : main.workspace.id;
  const onScreen = list.find((m) => m.workspace.id === shownId);

  return (
    <WorkspaceProvider workspace={main.workspace} role={main.role}>
      <AppFrame title={<PageBreadcrumb />} workspaceId={(list.length === 1 ? list[0]! : main).workspace.id}>
        {/* Today's rate missing: the strip across the top, with Set rates (for the shop on screen). */}
        {onScreen ? (
          <ShopContext membership={onScreen}>
            <MissingRates />
          </ShopContext>
        ) : null}
        <div className="flex w-full flex-col gap-8 px-6 pt-10 pb-16">
          {/* The greeting in the middle; at the end, today's rate (tap it to change it). */}
          <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <span />
            <Greeting />
            <span className="flex justify-end">
              {onScreen ? (
                <ShopContext membership={onScreen}>
                  <Suspense fallback={null}>
                    <RateChip />
                  </Suspense>
                </ShopContext>
              ) : null}
            </span>
          </header>
          <YourShops shops={list} main={main.workspace} onShown={setShown} />
          <QuickActionsGrid shops={list} shopId={shownId} />
        </div>
      </AppFrame>
    </WorkspaceProvider>
  );
}

/** The shop on screen as the context, so its own rate is read and set. */
function ShopContext({ membership, children }: { membership: WorkspaceMembership; children: ReactNode }) {
  return (
    <WorkspaceProvider workspace={membership.workspace} role={membership.role}>
      {children}
    </WorkspaceProvider>
  );
}

/** The red strip while today's rate is missing; Set rates opens the rates dialog. */
function MissingRates() {
  const [currencies, setCurrencies] = useState<CurrencyCode[] | null>(null);
  return (
    <>
      <RatesBanner isToday onSet={setCurrencies} />
      <SetRates currencies={currencies} onClose={() => setCurrencies(null)} />
    </>
  );
}

function SetRates({ currencies, onClose }: { currencies: CurrencyCode[] | null; onClose: () => void }) {
  const { workspace } = useWorkspaceShop();
  const board = useDaySummary(workspace.id).data?.board;
  if (!board) return null;
  return (
    <RatesDialog
      open={currencies !== null}
      onOpenChange={(open) => (open ? undefined : onClose())}
      workspaceId={workspace.id}
      date={businessDate(workspace.timeZone)}
      currencies={currencies ?? []}
      board={board}
    />
  );
}
