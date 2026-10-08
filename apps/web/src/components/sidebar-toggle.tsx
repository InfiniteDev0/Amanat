'use client';

import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useSidebar } from '@/components/ui/sidebar';

/**
 * Top of the sidebar: the button that opens and folds it (») with a short line
 * under it. Folded, just the icon, centred on the rail. Open, a full-width row
 * that says Collapse, with a rectangle that shows on hover like the pages below.
 */
export function SidebarToggle() {
  const t = useTranslations('shell');
  const { state, toggleSidebar } = useSidebar();
  const open = state === 'expanded';
  const Icon = open ? ChevronsLeftIcon : ChevronsRightIcon;

  return (
    <div className="flex flex-col gap-3 pt-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={open ? t('collapseSidebar') : t('expandSidebar')}
        aria-expanded={open}
        className="text-sidebar-foreground flex h-10 w-full items-center gap-3 rounded-md px-3 text-start text-base font-semibold transition-colors hover:bg-white/10 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:px-0"
      >
        <Icon className="size-6 shrink-0 rtl:rotate-180" strokeWidth={2.5} />
        <span className="truncate group-data-[collapsible=icon]:hidden">{t('collapse')}</span>
      </button>
      <span aria-hidden className="bg-sidebar-foreground/40 h-0.5 w-full rounded-full group-data-[collapsible=icon]:w-6" />
    </div>
  );
}
