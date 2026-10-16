'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { MorphingTabs } from '@/components/motion/morphing-tabs';
import { RateChip } from '@/features/rates/rate-chip';
import { usePathname, useRouter } from '@/i18n/navigation';

import { hrefFor, isLinkActive, NAV_MAIN } from './navigation';

/**
 * The shop's pages as browser-style tabs along the top of the main panel
 * (there is no sidebar): Home · Exchange · Amanat · Reports. The open page's
 * tab joins the panel under it, and the page itself is the panel's body. The
 * picked day (?day=…) goes along so every page shows the same day. On a page
 * the tabs don't cover (Settings, People…) no tab is marked. Today's rate sits
 * at the far end of the row, on every page.
 */
export function PageTabs({ workspaceId, children }: { workspaceId: string; children: ReactNode }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const day = useSearchParams().get('day');
  const active = NAV_MAIN.find((item) => isLinkActive(pathname, workspaceId, item))?.key ?? null;

  return (
    <MorphingTabs
      ariaLabel={t('pages')}
      items={NAV_MAIN.map((item) => ({ id: item.key, label: t(item.key) }))}
      value={active}
      onValueChange={(key) => {
        const item = NAV_MAIN.find((i) => i.key === key);
        if (!item) return;
        const href = hrefFor(workspaceId, item);
        router.push(day ? `${href}?day=${day}` : href);
      }}
      panelKey={pathname}
      end={<RateChip />}
      className="min-h-0 flex-1"
      classNames={{ content: 'scrollbar-pill mb-2' }}
    >
      {children}
    </MorphingTabs>
  );
}
