'use client';

import { useLocale } from 'next-intl';
import { type CSSProperties, type ReactNode, Suspense, useState } from 'react';

// Sidebar off for now (see below).
// import { AppSidebar } from '@/components/app-sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { PageTabs } from '@/features/workspaces/page-tabs';
import { SidebarProvider } from '@/components/ui/sidebar';
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
 *    Off for now; see below.
 * 3. Main: the pages as browser-style tabs on a rounded panel (page-tabs.tsx);
 *    the open page is the panel's body, and only it scrolls. The tabs name the
 *    page, so the panel has no header.
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
        {/* Sidebar off for now: the main panel takes the full width. To bring it
            back, uncomment this and the import, and drop mx-2 mb-2 below (the
            sidebar's own p-2 makes that gap).
            Below the top bar (h-12), not over it. The card's own padding (p-2,
            "inset") is the gap to the screen's edges and to the main panel.
        <AppSidebar variant="inset" dir={dir} workspaceId={workspaceId} className="top-12 bottom-0 h-auto pt-0" /> */}
        {/* The pages as tabs along the top of the main panel; the open page is its body. */}
        <Suspense fallback={null}>
          <PageTabs workspaceId={workspaceId}>{children}</PageTabs>
        </Suspense>
      </SidebarProvider>
    </div>
  );
}
