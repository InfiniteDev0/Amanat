'use client';

import { StoreIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { colourFor, ShopBadge } from '@/components/shop-badge';
import { useStartNewShop } from '@/features/onboarding/setup-wizard';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const MAX_PER_ROW = 5;

/**
 * Every shop you're in, as a row of cards (Notion's "Recently visited"): a band
 * in the shop's colour, its badge half over the band, its name under. A card
 * opens that shop; the one you're in is marked. The cards share the row's
 * width, at most five to a row.
 */
export function YourShops() {
  const t = useTranslations('home');
  const { workspace: current } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const startNewShop = useStartNewShop();
  if (shops.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <StoreIcon className="size-4" />
          {t('yourShops')}
        </h2>
        {/* Opens the setup wizard. White on black in dark mode, black on white in light. */}
        <button
          type="button"
          onClick={startNewShop}
          className="bg-foreground text-background flex h-9 items-center rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          {t('addShop')}
        </button>
      </div>
      {/* Up to five a row, sharing the width: two shops get half each, three a
          third each… a sixth starts the next row. */}
      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(shops.length, MAX_PER_ROW)}, minmax(0, 1fr))` }}>
        {shops.map(({ workspace }) => (
          <li key={workspace.id} className="min-w-0">
            <Link
              href={`/w/${workspace.id}`}
              aria-current={workspace.id === current.id ? 'page' : undefined}
              className="bg-foreground/5 hover:bg-foreground/8 aria-[current=page]:bg-foreground/10 flex h-40 w-full flex-col overflow-hidden rounded-2xl transition-colors"
            >
              <span className={cn('h-14 shrink-0 opacity-30', colourFor(workspace.id))} />
              <ShopBadge id={workspace.id} name={workspace.name} className="ms-4 -mt-4 size-8 rounded-lg text-sm" />
              <span className="line-clamp-2 px-4 pt-3 text-[15px] leading-snug font-medium">{workspace.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
