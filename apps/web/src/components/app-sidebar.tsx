'use client';

import type { ComponentProps } from 'react';

import { NavMain } from '@/components/nav-main';
import { SidebarBrand } from '@/components/sidebar-brand';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { NAV_BOTTOM, NAV_MAIN } from '@/features/workspaces/navigation';
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
 * pages, Settings pinned at the bottom above the brand. No account menu: the
 * shop menu in the top bar has it. Pages live in features/workspaces/navigation.ts.
 */
export function AppSidebar({ workspaceId, className, ...props }: ComponentProps<typeof Sidebar> & { workspaceId: string }) {
  return (
    <Sidebar collapsible="icon" className={cn(BLACK_SIDEBAR_CLASS, className)} {...props}>
      <SidebarHeader>
        <SidebarToggle />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={NAV_MAIN} workspaceId={workspaceId} />
      </SidebarContent>
      <SidebarFooter>
        <NavMain items={NAV_BOTTOM} workspaceId={workspaceId} />
        <SidebarBrand />
      </SidebarFooter>
    </Sidebar>
  );
}
