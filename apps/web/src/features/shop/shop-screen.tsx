'use client';

import { ActivityIcon, ArrowLeftIcon, ArrowLeftRightIcon, ChartNoAxesColumnIcon, HandCoinsIcon, StarIcon, TrendingUpIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { AccountDialog } from '@/features/accounts/account-dialog';
import { AccountCards } from '@/features/home/account-cards';
import { useDaySummary } from '@/features/home/queries';
import { ShopActions } from '@/features/home/shop-actions';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'activity', icon: <ActivityIcon /> },
  { id: 'exchange', icon: <ArrowLeftRightIcon /> },
  { id: 'profit', icon: <TrendingUpIcon /> },
  { id: 'amanat', icon: <HandCoinsIcon /> },
  { id: 'reports', icon: <ChartNoAxesColumnIcon /> },
] as const;

type Tab = (typeof TABS)[number]['id'];

/**
 * One shop's page (/w/<id>): back to Home, its name (★ on the main shop),
 * its drawers as cards (each account's balance; a card opens it), the
 * everyday actions recording into this shop, Close day, then the tabs:
 * Recent activity, Exchange, Profit, Amanat, Reports. Nothing is recorded in
 * the database yet (Phase 3), so the tabs show friendly empty states.
 */
export function ShopScreen() {
  const t = useTranslations('shop');
  const { workspace } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const [tab, setTab] = useState<Tab>('activity');
  const [accountId, setAccountId] = useState<string | null>(null);
  const summary = useDaySummary(workspace.id).data;
  const isMain = shops.find((m) => m.workspace.id === workspace.id)?.workspace.isMain ?? workspace.isMain;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-8 pb-16">
      <header className="flex flex-col gap-3">
        <Link href="/home" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors">
          <ArrowLeftIcon className="size-4 rtl:rotate-180" />
          {t('back')}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          {workspace.name}
          {isMain ? <StarIcon aria-label={t('main')} className="size-5 fill-amber-500 text-amber-500" /> : null}
        </h1>
      </header>

      <AccountCards date={undefined} onOpen={setAccountId} />

      {shops.length ? <ShopActions shops={shops} defaultShopId={workspace.id} closeDay /> : null}

      <section className="flex flex-col gap-4">
        <div role="tablist" aria-label={t('tabsLabel')} className="border-border flex gap-1 overflow-x-auto border-b">
          {TABS.map(({ id, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                '-mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors [&_svg]:size-4',
                tab === id ? 'border-foreground text-foreground' : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {icon}
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          <EmptyState icon={TABS.find((item) => item.id === tab)!.icon}>{t(`empty.${tab}`)}</EmptyState>
        </div>
      </section>

      {summary ? (
        <AccountDialog
          position={summary.accounts.find((p) => p.account.id === accountId) ?? null}
          positions={summary.accounts}
          board={summary.board}
          onClose={() => setAccountId(null)}
        />
      ) : null}
    </div>
  );
}

function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-foreground/3 text-muted-foreground flex flex-col items-center gap-3 rounded-2xl px-6 py-14 text-center text-sm">
      <span className="bg-foreground/5 flex size-10 items-center justify-center rounded-xl [&_svg]:size-5">{icon}</span>
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
