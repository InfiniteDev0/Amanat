'use client';

import type { ReactNode } from 'react';

// The sidebar is off: Home and the shop page have no side menu (Phase 2a/2b
// layouts). It comes back with these imports and the old frame below.
// import { useLocale } from 'next-intl';
// import { type CSSProperties, useState } from 'react';
// import { AppSidebar } from '@/components/app-sidebar';
// import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
// import { directionOf } from '@/i18n/routing';
import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { TopBar } from '@/components/layout/top-bar';

/**
 * The app in two sections: the top bar across the whole width (you, where
 * you are, the activity log and the bell), and under it a rounded, bordered
 * panel where the page renders. Home and every shop page use it; the setup
 * wizard draws it behind itself.
 */
export function AppFrame({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <TopBar title={title} />
      <div className="border-border mx-2 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="scrollbar-pill flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** A shop's pages: the frame with Home › the shop › the page in the top bar. */
export function WorkspaceFrame({ workspaceId, shopName, children }: { workspaceId: string; shopName: string; children: ReactNode }) {
  return <AppFrame title={<PageBreadcrumb shop={{ id: workspaceId, name: shopName }} />}>{children}</AppFrame>;
}

/* The old frame, with the sidebar (ClickUp-style: top bar, sidebar card, main panel).

const SIDEBAR_COOKIE = 'sidebar_state';

function sidebarWasOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${SIDEBAR_COOKIE}=true`);
}

export function WorkspaceFrame({ workspaceId, shopName, children }: { workspaceId: string; shopName: string; children: ReactNode }) {
  const dir = directionOf(useLocale());
  const [defaultOpen] = useState(sidebarWasOpen);

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <TopBar workspaceId={workspaceId} shopName={shopName} />
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="min-h-0 flex-1"
        style={{ '--sidebar-width': 'calc(var(--spacing) * 72)', '--sidebar-width-icon': 'calc(var(--spacing) * 14)' } as CSSProperties}
      >
        <AppSidebar variant="inset" dir={dir} workspaceId={workspaceId} className="top-14 bottom-0 h-auto pt-0" />
        <SidebarInset className="border-border mt-0! min-h-0 overflow-hidden rounded-lg! border">
          <div className="scrollbar-pill flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
*/
