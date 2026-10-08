'use client';

import { useLocale } from 'next-intl';
import { type CSSProperties, type ReactNode, useState } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { SiteHeader } from '@/components/site-header';
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
 * The app in three clean sections, ClickUp-style:
 *
 * 1. Top bar: across the whole width, on the page itself (the shop switch).
 * 2. Sidebar: a rounded card under it, folded to icons until opened (remembered).
 * 3. Main: a rounded, bordered panel beside it with the page's header; only
 *    its contents scroll.
 *
 * Sidebar and main start at the same height and end the same gap above the
 * bottom. The setup wizard draws the same frame behind itself.
 */
export function WorkspaceFrame({ workspaceId, shopName, children }: { workspaceId: string; shopName: string; children: ReactNode }) {
  const dir = directionOf(useLocale());
  const [defaultOpen] = useState(sidebarWasOpen);

  return (
    <div className="bg-background flex h-svh flex-col overflow-hidden">
      <TopBar workspaceId={workspaceId} shopName={shopName} />
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
        {/* Below the top bar (h-12), not over it. The card's own padding (p-2,
            "inset") is the gap to the screen's edges and to the main panel. */}
        <AppSidebar variant="inset" dir={dir} workspaceId={workspaceId} className="top-12 bottom-0 h-auto pt-0" />
        <SidebarInset className="border-border mt-0! min-h-0 overflow-hidden rounded-lg! border">
          <SiteHeader workspaceId={workspaceId} shopName={shopName} />
          <div className="scrollbar-pill flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
