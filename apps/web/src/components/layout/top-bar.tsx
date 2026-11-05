'use client';

import { type ReactNode, Suspense } from 'react';

// The shop menu is off: shops live on Home now, and top-left is your name.
// import { ShopMenu } from '@/components/layout/shop-menu';
import { NameMenu } from '@/components/layout/user-menu';
import { ActivityButton } from '@/features/activity/activity-sheet';
import { NotificationsButton } from '@/features/notifications/notifications-sheet';
// The day picker is off for now; it comes back with the import and the block below.
// import { SidebarDay } from '@/features/workspaces/sidebar-day';

/**
 * The bar across the top, like Milo's: slim, no line under it. Your name and
 * where you are at the start; the activity log and the bell at the end
 * (everything about you is in the name menu).
 */
export function TopBar({ title }: { title: ReactNode }) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <NameMenu />
        {title}
      </div>

      {/* The day picker, off for now.
      <Suspense fallback={null}>
        <SidebarDay />
      </Suspense> */}

      <div className="ms-auto flex shrink-0 items-center gap-1.5">
        <Suspense fallback={null}>
          <ActivityButton />
        </Suspense>
        <NotificationsButton />
      </div>
    </div>
  );
}
