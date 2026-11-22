'use client';

import { dealResult, dealSection, type DealRow, type Id, type Money } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { CheckIcon, FileDownIcon, PlusIcon, SearchIcon, SheetIcon, Trash2Icon, XIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

import { exportListCsv, exportListPdf, fileNameOf, type ResultColumn } from '@/features/calculator/search';
import { useRemoveDeals } from '@/features/deals/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { addUp } from './amounts';
import { useShortMoney } from './money-text';

/** An action on the selection bar. */
const BAR_ACTION = 'bg-muted text-foreground hover:bg-muted/70 flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors [&_svg]:size-4';

/**
 * Deals as a table to take away (PDF, CSV): when, what, in, out, the market
 * rate, my rate, the profit; and the profit added up.
 */
export function useDealExport() {
  const t = useTranslations('profit.export');
  const tProfit = useTranslations('profit');
  const locale = useLocale();
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const rate = (value: string | null | undefined) => (value ? Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '—');
  const columns: ResultColumn[] = [
    { label: t('time'), width: 0.8 },
    { label: t('kind'), width: 0.9 },
    { label: t('in'), width: 1.3, align: 'end' },
    { label: t('out'), width: 1.3, align: 'end' },
    { label: t('market'), width: 1, align: 'end' },
    { label: t('mine'), width: 1, align: 'end' },
    { label: t('profit'), width: 1.2, align: 'end' },
  ];
  const table = (rows: DealRow[]) =>
    rows.map(({ deal, profit }) => {
      const sallam = dealSection(deal) === 'sallam';
      return [
        new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(deal.createdAt)),
        sallam ? tProfit('sallam') : tProfit('exchange'),
        money({ amount: deal.amountIn, currency: deal.currencyIn }),
        money({ amount: deal.amountOut, currency: deal.currencyOut }),
        sallam ? '—' : rate(deal.todayRate),
        sallam ? (deal.percent ? `${deal.percent}%` : '—') : rate(deal.customerRate),
        profit ? money(profit, true) : '—',
      ];
    });
  const totalText = (rows: DealRow[]) => {
    const total: Money[] = addUp(rows.map((row) => row.profit));
    return total.length ? total.map((m) => money(m, true)).join(' · ') : '0';
  };
  return {
    pdf: (rows: DealRow[], title: string, scope: string) =>
      exportListPdf({
        shop: workspace.name,
        title,
        scope,
        summary: `${t('count', { count: rows.length })}   |   ${t('profit')} ${totalText(rows)}`,
        fileName: fileNameOf(`${workspace.name} ${title} ${scope}`, 'profit'),
        columns,
        rows: table(rows),
        total: { label: t('total'), value: totalText(rows) },
      }).catch(() => gooeyToast.error(t('couldNotPdf'))),
    csv: (rows: DealRow[], title: string, scope: string) =>
      exportListCsv(
        fileNameOf(`${workspace.name} ${title} ${scope}`, 'profit'),
        columns.map((c) => c.label),
        [...table(rows), columns.map((_, i) => (i === 0 ? t('total') : i === columns.length - 1 ? totalText(rows) : ''))],
      ),
  };
}

// A day's deals as Barista's class schedule: a title pill with its search and
// +, a line saying what's in it with its count, a line under them; then each
// deal as a time box: what came in (From) on the left, a dotted arrow down to
// what went out (To), and a card beside it with three short lines (the market
// rate, my rate, the profit), its edge green when it made money, red when not.

/** As Fleet Manager's trips: a block at the start, a dotted arrow down, a block at the end. */
function RouteMarks() {
  return (
    <span className="relative w-3 shrink-0">
      <svg viewBox="0 0 16 100" fill="none" aria-hidden className="absolute inset-0 size-full">
        <path fill="#0046E0" stroke="#9FBBF7" strokeWidth=".5" d="M14 2v12H2V2h12z" />
        <rect width="4" height="4" x="6" y="6" stroke="#fff" rx="2" />
        <path fill="#0046E0" stroke="#9FBBF7" strokeWidth=".5" d="M14 86v12H2V86h12z" />
        <rect width="4" height="4" x="6" y="90" fill="#fff" stroke="#fff" rx="2" />
        <path
          fill="#636D78"
          fillRule="evenodd"
          d="M7.872 20v1.454h1V20h-1zm0 4.361v2.907h1v-2.907h-1zm0 5.815v2.907h1v-2.907h-1zm0 5.814v2.907h1V35.99h-1zm0 5.815v2.907h1v-2.907h-1zm0 5.815v2.907h1V47.62h-1zm0 5.814v2.907h1v-2.907h-1zm0 5.815v2.907h1V59.25h-1zm0 5.814v2.908h1v-2.908h-1zm0 5.815v2.907h1v-2.907h-1zm1 7.819V75h-1v3.697l-2.129-2.365-.743.67 3 3.333.372.412.371-.412 3-3.334-.743-.669-2.128 2.365z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function RoundButton({ label, on, onClick, solid, children }: { label: string; on?: boolean; onClick: () => void; solid?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-8 items-center justify-center rounded-full transition-colors [&_svg]:size-4',
        solid ? 'bg-foreground text-background hover:opacity-90' : cn('border-foreground/15 text-foreground/60 hover:text-foreground border', on && 'border-foreground/40 text-foreground'),
      )}
    >
      {children}
    </button>
  );
}

/** One deal: its tick, From over To, the card of rates and profit beside it. */
function DealEntry({ row, ticked, ticking, onTick }: { row: DealRow; ticked: boolean; ticking: boolean; onTick: () => void }) {
  const t = useTranslations('profit.card');
  const money = useShortMoney();
  const { deal, profit } = row;
  const sallam = dealSection(deal) === 'sallam';
  const made = (profit?.amount ?? 0) >= 0;
  const percent = deal.percent ?? dealResult(deal)?.percent;
  return (
    <div className="group/row flex shrink-0 gap-3">
      {/* The tick, on the left: under the pointer, and while any is ticked. */}
      <div className="flex w-[18px] shrink-0 pt-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={ticked}
          aria-label={ticked ? t('unselect') : t('select')}
          onClick={onTick}
          className={cn(
            'flex size-[18px] items-center justify-center rounded-[5px] border transition-[opacity,colors]',
            ticking ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100',
            ticked ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:border-foreground/60',
          )}
        >
          {ticked ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
        </button>
      </div>
      <div className="flex w-36 shrink-0 flex-col pt-2.5 leading-snug tabular-nums">
        <div className="flex items-stretch gap-2">
          <RouteMarks />
          <div dir="ltr" className="flex min-w-0 flex-col text-start">
            <span className="text-foreground truncate text-sm font-medium">{money({ amount: deal.amountIn, currency: deal.currencyIn })}</span>
            <span className="text-foreground/50 mt-5 truncate text-[13px]">{money({ amount: deal.amountOut, currency: deal.currencyOut })}</span>
          </div>
        </div>
      </div>
      {/* Square on the accent's side, so the edge runs straight. */}
      <div
        onClick={ticking ? onTick : undefined}
        className={cn('bg-card relative min-w-0 flex-1 rounded-s-none rounded-e-lg border-s-2 px-3 py-2.5', made ? 'border-emerald-500' : 'border-red-500', ticked && 'ring-2 ring-sky-500', ticking && 'cursor-pointer')}
      >
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {sallam ? (
            <>
              <dt className="text-muted-foreground">{t('percent')}</dt>
              <dd dir="ltr" className="truncate text-end tabular-nums">
                {percent ? `${Math.abs(Number(percent))}%` : '—'}
              </dd>
            </>
          ) : (
            <>
              <dt className="text-muted-foreground">{t('market')}</dt>
              <dd dir="ltr" className="truncate text-end tabular-nums">
                {deal.todayRate ? Number(deal.todayRate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </dd>
              <dt className="text-muted-foreground">{t('mine')}</dt>
              <dd dir="ltr" className="truncate text-end tabular-nums">
                {deal.customerRate ? Number(deal.customerRate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('profit')}</dt>
          <dd className="min-w-0 truncate text-end">
            <span
              dir="ltr"
              className={cn(
                'inline-block max-w-full truncate rounded-[4px] px-2 py-0.5 align-middle text-xs font-semibold tabular-nums',
                made ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/15 text-red-600 dark:text-red-400',
              )}
            >
              {profit ? money(profit, true) : '—'}
            </span>
          </dd>
          {deal.customer ? (
            <>
              <dt className="text-muted-foreground">{t('customer')}</dt>
              <dd className="truncate text-end">{deal.customer}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

/**
 * The card: Exchange (or Sallam) in its pill, search and + beside it, what's
 * in it and how many, then the deals. Straight on the page, a line under its
 * heading, as Barista's Classes.
 */
export function DealsCard({
  title,
  sub,
  scope,
  rows,
  loading,
  onAdd,
  addLabel,
  empty,
}: {
  title: string;
  sub: string;
  /** The day, for a download's name: "Sun, Nov 22". */
  scope: string;
  rows: DealRow[];
  loading?: boolean;
  onAdd: () => void;
  addLabel: string;
  empty: string;
}) {
  const t = useTranslations('profit.card');
  const money = useShortMoney();
  const { workspace } = useWorkspace();
  const remove = useRemoveDeals(workspace.id);
  const take = useDealExport();
  const [query, setQuery] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<Id>>(new Set());
  const toggle = (id: Id) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosen = rows.filter((row) => ticked.has(row.deal.id));
  const deleteTicked = () => {
    const ids = [...ticked];
    setTicked(new Set());
    remove.mutateAsync({ ids }).then(
      () =>
        gooeyToast.success(t('deleted', { count: ids.length }), {
          action: { label: t('undo'), successLabel: t('restored'), onClick: () => void remove.mutateAsync({ ids, restore: true }) },
        }),
      () => gooeyToast.error(t('couldNotDelete')),
    );
  };
  const words = (query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((row) => {
    const text = `${row.deal.customer ?? ''} ${row.deal.note ?? ''} ${money({ amount: row.deal.amountIn, currency: row.deal.currencyIn })} ${money({ amount: row.deal.amountOut, currency: row.deal.currencyOut })}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-2">
        <span className="bg-card ring-foreground/10 truncate rounded-lg px-3 py-1.5 text-sm font-medium ring-1">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <RoundButton label={t('search', { title })} on={query !== null} onClick={() => setQuery(query === null ? '' : null)}>
            <SearchIcon />
          </RoundButton>
          <RoundButton label={addLabel} onClick={onAdd} solid>
            <PlusIcon />
          </RoundButton>
        </div>
      </div>
      <div className="text-foreground/45 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate">{sub}</span>
        <span className="shrink-0 tabular-nums">{t('count', { count: rows.length })}</span>
      </div>
      <div aria-hidden className="mb-2 border-b border-black/[0.07] dark:border-white/[0.08]" />
      {query !== null ? (
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && setQuery(null)}
          placeholder={t('search', { title })}
          aria-label={t('search', { title })}
          className="border-foreground/10 bg-card focus:border-foreground/30 h-9 shrink-0 rounded-lg border px-3 text-sm outline-none"
        />
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="bg-card h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="text-foreground/35 py-6 text-center text-xs">{rows.length === 0 ? empty : t('noMatch')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((row) => (
            <DealEntry key={row.deal.id} row={row} ticked={ticked.has(row.deal.id)} ticking={ticked.size > 0} onTick={() => toggle(row.deal.id)} />
          ))}
        </div>
      )}
      {ticked.size > 0 && typeof document !== 'undefined'
        ? createPortal(
            // Floating at the foot of the screen, as Barista's: how many, then what to do with them.
            <motion.div
              role="toolbar"
              aria-label={t('selectedBar')}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-popover text-popover-foreground ring-foreground/10 fixed inset-x-0 bottom-6 z-[120] mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 overflow-x-auto rounded-xl p-2 shadow-xl ring-1"
            >
              <span className="bg-muted flex h-9 shrink-0 items-center gap-2 rounded-lg ps-3 pe-1 text-sm font-medium">
                <span className="tabular-nums">{t('selected', { count: ticked.size })}</span>
                <span aria-hidden className="bg-foreground/15 h-4 w-px" />
                <button type="button" onClick={() => setTicked(new Set())} aria-label={t('unselectAll')} className="hover:bg-foreground/10 flex size-7 items-center justify-center rounded-md transition-colors">
                  <XIcon className="size-4" />
                </button>
              </span>
              <button type="button" onClick={() => void take.pdf(chosen, title, scope)} className={BAR_ACTION}>
                <FileDownIcon />
                {t('pdf')}
              </button>
              <button type="button" onClick={() => take.csv(chosen, title, scope)} className={BAR_ACTION}>
                <SheetIcon />
                {t('csv')}
              </button>
              <button type="button" onClick={deleteTicked} className={cn(BAR_ACTION, 'text-red-600 dark:text-red-400')}>
                <Trash2Icon />
                {t('delete')}
              </button>
            </motion.div>,
            document.body,
          )
        : null}
    </section>
  );
}
