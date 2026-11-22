'use client';

import { type ComponentProps, Suspense } from 'react';

import { NavMain } from '@/components/nav-main';
import { ShopSwitcher } from '@/components/shop-switcher';
import { SidebarBrand } from '@/components/sidebar-brand';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { NAV_FOOT, NAV_MAIN } from '@/features/workspaces/navigation';
import { cn } from '@/lib/utils';

// A black sidebar, open or folded to icons. The sidebar's own colour tokens are
// re-pointed for this subtree only, so every `*-sidebar-*` utility inside
// follows along whatever the page's theme.
const BLACK_SIDEBAR_CLASS = [
  '[&>[data-sidebar=sidebar]]:bg-black',
  'text-sidebar-foreground',
  '[--sidebar-foreground:oklch(0.985_0_0)]',
  '[--sidebar-accent:oklch(1_0_0/10%)]',
  '[--sidebar-accent-foreground:oklch(0.985_0_0)]',
  '[--sidebar-border:oklch(1_0_0/12%)]',
  '[--sidebar-ring:oklch(1_0_0/40%)]',
].join(' ');

/**
 * The sidebar-07 block: folds to an icon rail (`collapsible="icon"`), the
 * name small under each icon. The open/fold button at the top, then the
 * pages; Settings and Trash at the foot, then the shop switcher, above the brand (which
 * opens the plans). Pages live in features/workspaces/navigation.ts.
 */
export function AppSidebar({
  workspaceId,
  still = false,
  className,
  ...props
}: ComponentProps<typeof Sidebar> & {
  workspaceId: string;
  /** Drawn while the app starts (nothing signed in yet): the brand where the shop switcher will be. */
  still?: boolean;
}) {
  return (
    <Sidebar collapsible="icon" className={cn(BLACK_SIDEBAR_CLASS, className)} {...props}>
      <SidebarHeader>
        <SidebarToggle />
      </SidebarHeader>

      <SidebarContent>
        {/* The pages: Home, Profit, Reports, Amanat. */}
        <Suspense fallback={null}>
          <NavMain items={NAV_MAIN} workspaceId={workspaceId} />
        </Suspense>
      </SidebarContent>

      <SidebarFooter>
        {/* Settings and Trash. */}
        <Suspense fallback={null}>
          <NavMain items={NAV_FOOT} workspaceId={workspaceId} className="p-0" />
        </Suspense>
        {/* The shop switcher, as Notion's workspaces (the brand while the app starts). */}
        {still ? null : <ShopSwitcher />}
        <SidebarBrand />
      </SidebarFooter>
    </Sidebar>
  );
}
