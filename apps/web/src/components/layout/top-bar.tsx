'use client';

import { type ReactNode, Suspense } from 'react';

// The shop menu is off: shops live on Home now, and top-left is you (UserMenu).
// import { ShopMenu } from '@/components/layout/shop-menu';
import { UserMenu } from '@/components/layout/user-menu';
import { ActivityButton } from '@/features/activity/activity-sheet';
import { NotificationsButton } from '@/features/notifications/notifications-sheet';
// The day picker is off for now; it comes back with the import and the block below.
// import { SidebarDay } from '@/features/workspaces/sidebar-day';

/**
 * The bar across the top of the app, on the page itself (no panel): you
 * (your account menu) and where you are at the start, the activity log and
 * the bell at the end.
 */
export function TopBar({ title }: { title: ReactNode }) {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-2">
      <div className="flex min-w-0 items-center gap-3">
        <UserMenu />
        {title}
      </div>

      {/* The centre stays, so the start and end keep their places.
      <Suspense fallback={null}>
        <SidebarDay />
      </Suspense> */}
      <div />

      <div className="flex items-center justify-end gap-3">
        <Suspense fallback={null}>
          <ActivityButton />
        </Suspense>
        <NotificationsButton />
      </div>
    </div>
  );
}
