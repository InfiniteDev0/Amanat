'use client';

import { Suspense } from 'react';

import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { ShopMenu } from '@/components/layout/shop-menu';
import { ActivityButton } from '@/features/activity/activity-sheet';
import { NotificationsButton } from '@/features/notifications/notifications-sheet';
import { SidebarDay } from '@/features/workspaces/sidebar-day';

/**
 * The bar across the top of the app, on the page itself (no panel), in three
 * parts: the shop menu and where you are (the breadcrumb) at the start, the
 * shop's day in the centre, and the activity log and the bell at the end.
 */
export function TopBar({ workspaceId, shopName }: { workspaceId: string; shopName: string }) {
  return (
    // px-2: the same gap to the edges as the sidebar card and the main panel below.
    <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
      <div className="flex min-w-0 items-center gap-3">
        <ShopMenu workspaceId={workspaceId} shopName={shopName} />
        <PageBreadcrumb workspaceId={workspaceId} />
      </div>

      <Suspense fallback={null}>
        <SidebarDay />
      </Suspense>

      <div className="flex items-center justify-end gap-3">
        <Suspense fallback={null}>
          <ActivityButton />
        </Suspense>
        <NotificationsButton />
      </div>
    </div>
  );
}
