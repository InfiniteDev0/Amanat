'use client';

import { dealResult, dealSection, type DealRow, type Money } from '@sarrif/core';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PlusIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, Suspense, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useDeals } from '@/features/deals/queries';
import { useDaySummary } from '@/features/home/queries';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { addUp, Amounts } from './amounts';
import { DealSheet } from './forms';
import { useShortMoney } from './money-text';

/** One row as a sentence: "Sold 20,000 $ cash at 0.8% → Sallam 20,160 $   +160 $". */
function Row({ row, onOpen }: { row: DealRow; onOpen: (row: DealRow) => void }) {
  const t = useTranslations('profit');
  const money = useShortMoney();
  const { can } = useWorkspace();
  const { deal, profit, locked, recordedBy } = row;
  const result = dealResult(deal);
  let sentence: string;
  if (dealSection(deal) === 'sallam') {
    const percent = deal.percent ?? (result?.percent ? String(Math.abs(Number(result.percent))) : '');
    const what = { amount: money({ amount: deal.amountOut, currency: deal.currencyOut }), percent };
    const bought = (profit?.amount ?? 0) < 0;
    sentence = `${bought ? t('rowBought', what) : t('rowSold', what)} → ${t('rowSallam', { amount: money({ amount: deal.amountIn, currency: deal.currencyIn }) })}`;
  } else {
    const boughtUsd = deal.currencyIn === 'USD';
    const dollars = money({ amount: boughtUsd ? deal.amountIn : deal.amountOut, currency: 'USD' });
    const shillings = money({ amount: boughtUsd ? deal.amountOut : deal.amountIn, currency: 'KES' });
    const rate = Number(deal.customerRate ?? result?.rate ?? 0).toFixed(2);
    sentence = boughtUsd
      ? `${t('rowBoughtUsd', { amount: dollars, rate })} → ${t('rowPaid', { amount: shillings })}`
      : `${t('rowSoldUsd', { amount: dollars, rate })} → ${t('rowGot', { amount: shillings })}`;
  }
  const opens = !locked || can('edit_entry_closed_day');
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
      className="bg-card mb-2 overflow-hidden rounded-xl last:mb-0"
    >
      <button
        type="button"
        disabled={!opens}
        onClick={() => onOpen(row)}
        className="enabled:hover:bg-foreground/5 flex w-full items-center gap-4 px-4 py-3.5 text-start text-base transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block">
            {sentence}
            {deal.customer ? <span className="text-muted-foreground"> · {deal.customer}</span> : null}
          </span>
          {can('view_activity_all') ? <span className="text-muted-foreground block text-sm">{t('by', { name: recordedBy.name })}</span> : null}
        </span>
        {locked ? <LockIcon className="text-muted-foreground size-4 shrink-0" aria-label={t('closed')} /> : null}
        <span className="shrink-0 text-end">
          {profit ? <Amounts money={[profit]} /> : <span className="text-muted-foreground">—</span>}
        </span>
      </button>
    </motion.li>
  );
}

/** A section: its title (and a button), its rows, and its subtotal underneath. */
function Section({
  title,
  action,
  children,
  subtotalLabel,
  subtotal,
  count,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  subtotalLabel?: string;
  subtotal?: Money[];
  /** How many rows: "Total: 15" at the end of the title line. */
  count?: number;
}) {
  const t = useTranslations('profit');
  return (
    <section className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        {/* Small, in the banner's green gradient. */}
        <h2 className="w-fit bg-[#11998e] bg-[linear-gradient(to_right,#38ef7d,#11998e)] bg-clip-text text-sm font-semibold text-transparent">{title}</h2>
        {count !== undefined ? <span className="text-muted-foreground text-sm">{t('total', { count })}</span> : null}
        {action}
      </div>
      {children}
      {/* The section's profit, plain, at the end of the column. */}
      {subtotalLabel && subtotal ? (
        <div className="flex flex-wrap items-baseline justify-end gap-x-3 px-4 text-base">
          <span className="text-muted-foreground">{subtotalLabel}</span>
          <Amounts money={subtotal} />
        </div>
      ) : null}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground px-1 py-3 text-base">{children}</p>;
}

/**
 * The Profit page for the day picked in the top bar (docs/Sarrif App – Profit
 * forms.md, section 5): + Sallam and + Exchange at the top (they open their
 * forms as sheets), the day's Sallam rows and exchange rows side by side, each
 * with its own profit at the end. Tapping a row opens it to change or delete.
 */
export function ProfitPage() {
  return (
    <Suspense fallback={null}>
      <Profit />
    </Suspense>
  );
}

function Profit() {
  const t = useTranslations('profit');
  const locale = useLocale();
  const { workspace, can } = useWorkspace();
  const { day, today, isToday, previous, next, setDay } = useShopDay();
  const date = isToday ? undefined : day;
  const rows = useDeals(workspace.id, date);
  const todays = useDaySummary(workspace.id);
  const locked = (rows.data ?? []).some((row) => row.locked);
  const editable = isToday && can('record') && !locked;
  const [sheet, setSheet] = useState<{ type: 'sallam' | 'exchange'; editing: DealRow | null } | null>(null);
  const accounts = todays.data?.accounts.map((p) => p.account) ?? [];
  const all = rows.data ?? [];
  // Sallam is switched off for now: its rows stay in the books, only off this page.
  const sallam = all.filter((row) => dealSection(row.deal) === 'sallam');
  const exchange = all.filter((row) => dealSection(row.deal) === 'exchange');
  const open = (row: DealRow) => setSheet({ type: dealSection(row.deal), editing: row });
  const shownDate = new Date(`${day}T00:00:00Z`);
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(shownDate);
  const dayDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(shownDate);
  // How far back the day is, in blue: "Today", "Yesterday", "8 days ago".
  const daysBack = Math.round((Date.parse(`${today}T00:00:00Z`) - shownDate.getTime()) / 86_400_000);
  const relativeText = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-daysBack, 'day');
  const relative = relativeText.charAt(0).toLocaleUpperCase(locale) + relativeText.slice(1);
  const list = (items: DealRow[]) =>
    !rows.data ? (
      <div className="bg-card h-16 animate-pulse rounded-xl" />
    ) : items.length === 0 ? (
      <Empty>{t('none')}</Empty>
    ) : (
      <ul className="scrollbar-pill min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((row) => (
            <Row key={row.deal.id} row={row} onOpen={open} />
          ))}
        </AnimatePresence>
      </ul>
    );

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 p-4 lg:p-6">
      {/* Today · back · forward, like a calendar app; under it the day ("Sat Oct 3") and how far back it is, in blue. */}
      {/* Stays at the top while the lists scroll under it (the panel is what scrolls). */}
      <header className="bg-panel sticky top-0 z-10 -mx-4 -mt-4 flex flex-wrap items-end justify-between gap-4 px-4 pt-4 pb-2 lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDay(today)}
              disabled={isToday}
              className="border-border hover:bg-foreground/5 me-2 h-9 rounded-lg border px-3.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {t('today')}
            </button>
            <button
              type="button"
              onClick={previous}
              aria-label={t('previousDay')}
              className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors"
            >
              <ChevronLeftIcon className="size-5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={isToday}
              aria-label={t('nextDay')}
              className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground flex size-9 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
            >
              <ChevronRightIcon className="size-5 rtl:rotate-180" />
            </button>
          </div>
          <h1 className="flex items-baseline gap-2 text-2xl">
            <span className="font-bold">{dayName}</span>
            <span className="text-muted-foreground font-semibold">{dayDate}</span>
            <span className="text-sm font-semibold text-[#0079C1] dark:text-sky-400">{relative}</span>
            {locked ? <LockIcon className="text-muted-foreground size-5 self-center" aria-label={t('closed')} /> : null}
          </h1>
        </div>
        {editable ? (
          <div className="flex gap-2">
            <Button type="button" disabled onClick={() => setSheet({ type: 'sallam', editing: null })} className="h-9 rounded-lg px-3 text-sm font-semibold">
              <PlusIcon data-icon="inline-start" />
              {t('addSallam')}
            </Button>
            <Button type="button" onClick={() => setSheet({ type: 'exchange', editing: null })} className="h-9 rounded-lg px-3 text-sm font-semibold">
              <PlusIcon data-icon="inline-start" />
              {t('addExchange')}
            </Button>
          </div>
        ) : null}
      </header>

      {/* Side by side on a wide screen, one under the other on a phone. Fills the
          rest of the page; each list scrolls in its own box. */}
      <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <Section title={t('exchange')} count={rows.data ? exchange.length : undefined} subtotalLabel={t('exchangeProfit')} subtotal={addUp(exchange.map((row) => row.profit))}>
          {list(exchange)}
        </Section>

        <div aria-hidden className="bg-border hidden w-px self-stretch lg:block" />

        {/* Sallam: left blank for now (its rows are kept, just not shown); the column keeps its space. */}
        <div aria-hidden />
      </div>


      {todays.data ? (
        <DealSheet
          type={sheet?.type ?? 'sallam'}
          open={sheet !== null}
          onOpenChange={(isOpen) => (isOpen ? undefined : setSheet(null))}
          editing={sheet?.editing ?? null}
          accounts={accounts}
          board={todays.data.board}
          rows={sallam}
        />
      ) : null}
    </div>
  );
}
