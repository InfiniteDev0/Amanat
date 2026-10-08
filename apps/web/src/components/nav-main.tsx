'use client';

import { useTranslations } from 'next-intl';

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { hrefFor, isLinkActive, type NavItem } from '@/features/workspaces/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { maskStyle } from '@/lib/mask';

/* The icon image is used as a mask, not shown as-is, so its colour comes from
   state instead of the file's own baked-in gradient: grey at rest, yellow→pink
   on hover, yellow→green when active. `group/menu-button` is the class
   SidebarMenuButton already puts on every button; active wins over hover. */
function NavIcon({ src }: { src: string }) {
  return (
    // Folded, the icon sits in its own tile, the size and rounding of the
    // avatar above, and the tile (not the whole button) takes the hover and
    // active grey.
    <span className="flex shrink-0 items-center justify-center group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:group-hover/menu-button:bg-white/10 group-data-[collapsible=icon]:group-data-active/menu-button:bg-white/20!">
      <span
        aria-hidden
        style={maskStyle(src)}
        className="bg-sidebar-foreground/50 size-5 shrink-0 group-hover/menu-button:bg-[linear-gradient(135deg,#ffd600,#ff007a)] group-data-active/menu-button:bg-[linear-gradient(135deg,#ffd600,#00d078)]!"
      />
    </span>
  );
}

// Bigger than the shadcn defaults (h-8, 14px text, 16px icons) so the links are
// easier to read. Collapsed, the name sits small under the icon tile instead of
// in a tooltip, and the button itself has no fill (the tile does).
export const NAV_ITEM_CLASS = [
  'h-10 gap-3 px-3 text-[15px] [&_svg]:size-[18px]',
  'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-auto! group-data-[collapsible=icon]:w-14! group-data-[collapsible=icon]:h-auto! group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:bg-transparent!',
  // Collapsed, the name under the icon: small, centred, one line.
  'group-data-[collapsible=icon]:[&>span:last-child]:text-[11px] group-data-[collapsible=icon]:[&>span:last-child]:leading-tight',
  // Label: dimmed at rest, full strength on hover or when active.
  'text-sidebar-foreground/70 hover:text-sidebar-foreground data-active:text-sidebar-foreground',
  // Gray on hover; a brighter gray that stays put on the active tab.
  'data-active:bg-white/20 data-active:hover:bg-white/20',
].join(' ');

/** A list of pages for the current shop: icon + name, the active one marked. */
export function NavMain({ items, workspaceId, className }: { items: NavItem[]; workspaceId: string; className?: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <SidebarGroup className={className}>
      <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
        {items.map((item) => (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton
              isActive={isLinkActive(pathname, workspaceId, item)}
              className={NAV_ITEM_CLASS}
              render={<Link href={hrefFor(workspaceId, item)} />}
            >
              <NavIcon src={item.icon} />
              <span>{t(item.key)}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
