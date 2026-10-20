'use client';

import { ChevronsLeftIcon, ChevronsRightIcon, MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

/**
 * The sidebar's button, like Notion's, with a tooltip that names it and its
 * shortcut (Ctrl B, ⌘B on a Mac). `sidebar`: at the top of the open sidebar,
 * the « from the old Collapse row, which closes it. `page`: at the page's top
 * corner, only while the sidebar is closed, ☰ turning into » on hover, which
 * brings it back. A background only on hover.
 */
export function SidebarButton({ place, className }: { place: 'sidebar' | 'page'; className?: string }) {
  const t = useTranslations('shell');
  const { open, isMobile, openMobile, toggleSidebar } = useSidebar();
  // ⌘B on a Mac; Ctrl B on the server and everywhere else.
  const mac = useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const shown = isMobile ? openMobile : open;
  if (place === 'page' && shown) return null;
  const label = place === 'sidebar' ? t('closeSidebar') : t('openSidebar');

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={label}
            aria-expanded={shown}
            className={cn(
              'group/sidebar-button text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
              className,
            )}
          />
        }
      >
        {place === 'sidebar' ? (
          <ChevronsLeftIcon className="size-5 rtl:rotate-180" />
        ) : (
          <>
            <MenuIcon className="size-5 group-hover/sidebar-button:hidden" />
            <ChevronsRightIcon className="hidden size-5 group-hover/sidebar-button:block rtl:rotate-180" />
          </>
        )}
      </TooltipTrigger>
      {/* Dark in both themes and without the arrow, like Notion's. */}
      <TooltipContent side="bottom" align="start" className="flex-col items-start gap-0 rounded-lg bg-[#0f0f0f] px-2.5 py-1.5 text-sm text-white ring-1 ring-white/10 [&>:last-child]:hidden">
        <span className="font-medium">{label}</span>
        <span className="text-white/55">{mac ? t('sidebarShortcutMac') : t('sidebarShortcut')}</span>
      </TooltipContent>
    </Tooltip>
  );
}
