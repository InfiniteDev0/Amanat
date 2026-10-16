'use client';

import { ArrowDownUpIcon, ArrowLeftRightIcon, ChevronRightIcon, HandCoinsIcon, ReceiptIcon, SmartphoneIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useWorkspace } from '@/features/workspaces/workspace-context';

/** One row: an icon tile, what it does and a line under it, a chevron at the end. */
function ActionRow({ icon, title, hint, onClick }: { icon: ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card hover:bg-card/70 focus-visible:ring-ring/50 flex min-w-0 items-center gap-3 rounded-xl p-4 text-start transition-colors outline-none focus-visible:ring-3"
    >
      <span className="bg-foreground/5 flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{title}</span>
        <span className="text-muted-foreground truncate text-xs">{hint}</span>
      </span>
      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 rtl:rotate-180" />
    </button>
  );
}

/**
 * The shop's everyday jobs, one tap from Home: Sallam, Exchange, Move,
 * Amanat, Expense. Each opens its form as a sheet right here. Only for people
 * who can record.
 */
export function QuickActions({
  onSallam,
  onExchange,
  onMove,
  onAmanat,
  onExpense,
}: {
  onSallam: () => void;
  onExchange: () => void;
  onMove: () => void;
  onAmanat: () => void;
  onExpense: () => void;
}) {
  const t = useTranslations('home.quick');
  const { can } = useWorkspace();
  if (!can('record')) return null;

  return (
    <section aria-labelledby="quick-actions" className="flex flex-col gap-3">
      <h2 id="quick-actions" className="text-muted-foreground flex h-8 items-center gap-2 text-sm font-medium">
        <ZapIcon className="size-4" />
        {t('title')}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <ActionRow icon={<SmartphoneIcon />} title={t('sallam')} hint={t('sallamHint')} onClick={onSallam} />
        <ActionRow icon={<ArrowLeftRightIcon />} title={t('exchange')} hint={t('exchangeHint')} onClick={onExchange} />
        <ActionRow icon={<ArrowDownUpIcon />} title={t('move')} hint={t('moveHint')} onClick={onMove} />
        <ActionRow icon={<HandCoinsIcon />} title={t('amanat')} hint={t('amanatHint')} onClick={onAmanat} />
        <ActionRow icon={<ReceiptIcon />} title={t('expense')} hint={t('expenseHint')} onClick={onExpense} />
      </div>
    </section>
  );
}
