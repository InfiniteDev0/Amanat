'use client';

import { useQueries } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useAccountLabel } from '@/features/accounts/account-label';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { hrefFor, NAV_FOOT, NAV_MAIN } from '@/features/workspaces/navigation';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

import { type Searchable, searchable } from './search-match';

// What the search looks through, as Barista's: the pages, your shops and
// their accounts, each one line (an icon, the name, what tells it apart, a
// pill) that opens that very thing. Gathered only while the panel is open.

export type SearchKind = 'page' | 'shop' | 'account';
export type PillTone = 'emerald' | 'red' | 'blue' | 'cyan' | 'orange' | 'muted';

export interface SearchEntry {
  /** kind:id, the same every time, for Recent. */
  key: string;
  kind: SearchKind;
  title: string;
  /** The one thing that tells it apart, after the title. */
  detail: string;
  /** Its day, yyyy-mm-dd: newer first among equals. */
  date: string;
  pill: { label: string; tone: PillTone } | null;
  /** Its own icon (public/), when it isn't its kind's. */
  icon?: string;
  href: string;
  match: Searchable;
}

export const SCOPES = [
  { id: 'all', kinds: null },
  { id: 'shops', kinds: ['shop'] },
  { id: 'accounts', kinds: ['account'] },
  { id: 'pages', kinds: ['page'] },
] as const satisfies readonly { id: string; kinds: readonly SearchKind[] | null }[];

export type ScopeId = (typeof SCOPES)[number]['id'];

export function useSearchEntries(open: boolean): SearchEntry[] {
  const t = useTranslations();
  const label = useAccountLabel();
  const shops = useMyWorkspaces({ enabled: open }).data ?? [];
  const accounts = useQueries({
    queries: shops.map(({ workspace }) => ({ queryKey: queryKeys.accounts(workspace.id), queryFn: () => api.accounts.list(workspace.id), enabled: open })),
  });
  const accountLists = accounts.map((query) => query.data);

  // Worked out each time: a handful of shops and their accounts.
  {
    const main = shops.find((m) => m.workspace.isMain)?.workspace ?? shops[0]?.workspace;
    if (!main) return [];
    // The pages, for the main shop (Home is everyone's).
    const pages: SearchEntry[] = [...NAV_MAIN, ...NAV_FOOT].map((item) => {
      const title = t(`nav.${item.key}`);
      const detail = item.path === '' ? t('search.allShops') : main.name;
      return { key: `page:${item.key}`, kind: 'page', title, detail, date: '', pill: null, icon: item.icon, href: hrefFor(main.id, item), match: searchable(title, [detail]) };
    });
    const shopEntries: SearchEntry[] = shops.map(({ workspace }) => ({
      key: `shop:${workspace.id}`,
      kind: 'shop',
      title: workspace.name,
      detail: workspace.location,
      date: '',
      pill: workspace.isMain ? { label: t('search.main'), tone: 'orange' } : null,
      href: `/w/${workspace.id}`,
      match: searchable(workspace.name, [workspace.location, workspace.isMain ? t('search.main') : '']),
    }));
    const accountEntries: SearchEntry[] = shops.flatMap(({ workspace }, index) =>
      (accountLists[index] ?? [])
        .filter((account) => !account.archived)
        .map((account) => {
          const title = label(account);
          return {
            key: `account:${account.id}`,
            kind: 'account' as const,
            title,
            detail: workspace.name,
            date: '',
            pill: { label: account.currency, tone: account.currency === 'USD' ? ('emerald' as const) : ('blue' as const) },
            href: `/w/${workspace.id}`,
            match: searchable(title, [workspace.name, account.currency, account.provider]),
          };
        }),
    );
    return [...pages, ...shopEntries, ...accountEntries];
  }
}
