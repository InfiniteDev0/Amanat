'use client';

import { dealResult, dealSection, type DealRow } from '@sarrif/core';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { cn } from '@/lib/utils';

import { useShortMoney } from './money-text';

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

/** One deal: From over To on the left, the card of rates and profit beside it. */
function DealEntry({ row }: { row: DealRow }) {
  const t = useTranslations('profit.card');
  const money = useShortMoney();
  const { deal, profit } = row;
  const sallam = dealSection(deal) === 'sallam';
  const made = (profit?.amount ?? 0) >= 0;
  const percent = deal.percent ?? dealResult(deal)?.percent;
  return (
    <div className="flex shrink-0 gap-3">
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
      <div className={cn('bg-card relative min-w-0 flex-1 rounded-s-none rounded-e-lg border-s-2 px-3 py-2.5', made ? 'border-emerald-500' : 'border-red-500')}>
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
export function DealsCard({ title, sub, rows, loading, onAdd, addLabel, empty }: { title: string; sub: string; rows: DealRow[]; loading?: boolean; onAdd: () => void; addLabel: string; empty: string }) {
  const t = useTranslations('profit.card');
  const money = useShortMoney();
  const [query, setQuery] = useState<string | null>(null);
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
            <DealEntry key={row.deal.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
