'use client';

import { useLocale } from 'next-intl';
import { type CSSProperties, type ReactNode, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { PageBreadcrumb } from '@/components/layout/page-breadcrumb';
import { TopBar } from '@/components/layout/top-bar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { directionOf } from '@/i18n/routing';

/** What the sidebar's own toggle saves (components/ui/sidebar.tsx). */
const SIDEBAR_COOKIE = 'sidebar_state';

/** Folded unless the person opened it last time. */
function sidebarWasOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').includes(`${SIDEBAR_COOKIE}=true`);
}

/**
 * The app in three clean sections, on every page (Home and each shop):
 *
 * 1. Top bar: across the whole width: you (your account menu) and where you
 *    are, the activity log and the bell.
 * 2. Sidebar: a rounded card under it, folded to icons until opened
 *    (remembered). Home goes to /home; the other pages are the shop's
 *    (`workspaceId`: the shop you're in, or the main shop on Home).
 * 3. Main: a rounded, bordered panel beside it, where the page renders.
 *
 * Sidebar and main start at the same height and end the same gap above the
 * bottom. The setup wizard draws the same frame behind itself.
 */
export function AppFrame({ title, workspaceId, children }: { title: ReactNode; workspaceId: string; children: ReactNode }) {
  const dir = directionOf(useLocale());
  const [defaultOpen] = useState(sidebarWasOpen);

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <TopBar title={title} />
      <SidebarProvider
        defaultOpen={defaultOpen}
        className="min-h-0 flex-1"
        style={
          {
            '--sidebar-width': 'calc(var(--spacing) * 72)',
            // Wider than the 3rem default so the names under the icons fit when
            // the sidebar is folded.
            '--sidebar-width-icon': 'calc(var(--spacing) * 14)',
          } as CSSProperties
        }
      >
        {/* Below the top bar (h-11), not over it. The card's own padding (p-2,
            "inset") is the gap to the screen's edges and to the main panel. */}
        <AppSidebar variant="inset" dir={dir} workspaceId={workspaceId} className="top-12 bottom-0 h-auto pt-0" />
        <SidebarInset className="border-border mt-0! min-h-0 overflow-hidden rounded-sm! border">
          <div className="scrollbar-pill flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

/** A shop's pages: the frame with Home › the shop › the page in the top bar. */
export function WorkspaceFrame({ workspaceId, shopName, children }: { workspaceId: string; shopName: string; children: ReactNode }) {
  return (
    <AppFrame title={<PageBreadcrumb shop={{ id: workspaceId, name: shopName }} />} workspaceId={workspaceId}>
      {children}
    </AppFrame>
  );
}
