'use client';

import { useTranslations } from 'next-intl';

import { AmanatMark } from '@/components/brand';
import { Badge } from '@/components/ui/badge';

/**
 * Bottom of the sidebar: which app this is. Not a button or link. Open, the
 * mark sits beside the name; on the collapsed rail only the mark shows, in a tile the size of the avatar.
 */
export function SidebarBrand() {
  const t = useTranslations('brand');
  return (
    <div className="flex h-14 items-center gap-3 rounded-md bg-white/10 px-2 py-1.5 transition-all duration-500 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-0">
      <AmanatMark onDark className="h-6 group-data-[collapsible=icon]:h-5" />
      {/* The whole text block is removed on the rail, not just clipped: text
          still in the layout drags the centred mark off-centre. */}
      <div className="flex w-full min-w-0 flex-col group-data-[collapsible=icon]:hidden">
        <span className="flex items-center justify-between gap-2 truncate text-sm leading-tight font-light">
          {t('name')}
          <Badge className="rounded-sm bg-green-500/10 text-green-300">{t('plan')}</Badge>
        </span>
        <span className="text-sidebar-foreground/60 truncate text-xs">{t('shortTagline')}</span>
      </div>
    </div>
  );
}
