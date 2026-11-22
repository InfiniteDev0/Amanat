'use client';

import { addDays, type BusinessDate, type CurrencyCode, type Money, monthStart } from '@sarrif/core';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ComponentType, ReactNode } from 'react';

import { useShortMoney } from '@/features/profit/money-text';
import { cn } from '@/lib/utils';

// The run of days Profit and Reports work out, as Barista's calculator does:
// Today, the last 7 days, this month, last month, or your own first and last
// day; and the run before it of the same kind, for how the figures moved.

export const PERIODS = ['today', 'week', 'month', 'lastMonth', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

export interface DayRange {
  from: BusinessDate;
  to: BusinessDate;
}

const daysIn = ({ from, to }: DayRange) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
const monthEnd = (date: BusinessDate) => addDays(monthStart(addDays(monthStart(date), 32)), -1);

/** The days a period covers; never past today, and a custom run the right way round. */
export function rangeOf(period: Period, today: BusinessDate, custom: DayRange): DayRange {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: addDays(today, -6), to: today };
    case 'month':
      return { from: monthStart(today), to: today };
    case 'lastMonth': {
      const end = addDays(monthStart(today), -1);
      return { from: monthStart(end), to: end };
    }
    case 'custom': {
      const a = custom.from > today ? today : custom.from;
      const b = custom.to > today ? today : custom.to;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
}

/** The run to compare with: yesterday, the 7 days before, the same days of last month, the month before, or as many days before. */
export function previousOf(period: Period, range: DayRange): DayRange {
  if (period === 'month') {
    const start = monthStart(addDays(range.from, -1));
    const to = addDays(start, daysIn(range) - 1);
    const end = monthEnd(start);
    return { from: start, to: to > end ? end : to };
  }
  if (period === 'lastMonth') {
    const end = addDays(range.from, -1);
    return { from: monthStart(end), to: end };
  }
  return {
    from: addDays(range.from, -daysIn(range)),
    to: addDays(range.from, -1),
  };
}

/** "Sun 22 Nov", or "16 – 22 Nov", or "28 Oct – 3 Nov". */
export function useRangeLabel() {
  const locale = useLocale();
  return ({ from, to }: DayRange) => {
    const at = (date: string) => new Date(`${date}T12:00:00Z`);
    const day = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    if (from === to) return day.format(at(from));
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).formatRange(at(from), at(to));
  };
}

/**
 * The period picker: Today · Last 7 days · This month · Last month · Custom,
 * as a segmented control; Custom adds its two days beside it.
 */
export function PeriodPicker({
  period,
  onPeriod,
  custom,
  onCustom,
  today,
  layoutId,
}: {
  period: Period;
  onPeriod: (period: Period) => void;
  custom: DayRange;
  onCustom: (range: DayRange) => void;
  today: BusinessDate;
  /** Each page its own, so the highlight slides only within its own picker. */
  layoutId: string;
}) {
  const t = useTranslations('reports');
  const dateField = 'bg-foreground/5 h-9 rounded-lg px-2.5 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [color-scheme:light] dark:[color-scheme:dark]';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label={t('period')} className="bg-foreground/5 flex flex-wrap gap-0.5 rounded-lg p-1">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={period === option}
            onClick={() => onPeriod(option)}
            className={cn('relative rounded-md px-3 py-1.5 text-sm transition-colors', period === option ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {period === option ? (
              <motion.span layoutId={layoutId} transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="bg-card absolute inset-0 rounded-md shadow-[0_1px_2px_rgb(0_0_0/0.12)]" />
            ) : null}
            <span className="relative">{t(`periods.${option}`)}</span>
          </button>
        ))}
      </div>
      {period === 'custom' ? (
        <div className="flex items-center gap-1.5 text-sm">
          <label className="sr-only" htmlFor={`${layoutId}-from`}>
            {t('from')}
          </label>
          <input id={`${layoutId}-from`} type="date" value={custom.from} max={today} onChange={(e) => e.target.value && onCustom({ ...custom, from: e.target.value })} className={dateField} />
          <span className="text-muted-foreground">–</span>
          <label className="sr-only" htmlFor={`${layoutId}-to`}>
            {t('to')}
          </label>
          <input id={`${layoutId}-to`} type="date" value={custom.to} max={today} onChange={(e) => e.target.value && onCustom({ ...custom, to: e.target.value })} className={dateField} />
        </div>
      ) : null}
    </div>
  );
}

/** The figure to compare in a list of currencies: the base currency's, or the only one. */
export function figureOf(list: Money[], currency: CurrencyCode): number {
  return list.find((m) => m.currency === currency)?.amount ?? 0;
}

/** Which currency a card compares in: the base if it's there, else the first one it has. */
export function compareCurrency(now: Money[], before: Money[], base: CurrencyCode): CurrencyCode {
  if (now.some((m) => m.currency === base) || before.some((m) => m.currency === base)) return base;
  return now[0]?.currency ?? before[0]?.currency ?? base;
}

/** "▲ 12% vs yesterday" in green when it's good news, red when not; nothing when there's nothing to compare. */
export function Change({ now, before, upIsGood, period }: { now: number; before: number; upIsGood: boolean; period: Period }) {
  const t = useTranslations('reports');
  if (now === 0 && before === 0) return <span className="text-muted-foreground text-xs">{t(`versus.${period}`, { change: '—' })}</span>;
  if (before === 0) return <span className="text-muted-foreground text-xs">{t(`versus.${period}`, { change: t('new') })}</span>;
  const change = ((now - before) / Math.abs(before)) * 100;
  const up = change > 0;
  const good = change === 0 ? null : up === upIsGood;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className={cn('flex items-center gap-1 text-xs', good === null ? 'text-muted-foreground' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {change === 0 ? null : <Icon className="size-3.5" />}
      {t(`versus.${period}`, {
        change: `${Math.abs(change).toFixed(change !== 0 && Math.abs(change) < 10 ? 1 : 0)}%`,
      })}
    </span>
  );
}

/** A card of the calculator: its icon and name, the amount (each currency on its line), and how it moved. */
export function StatCard({
  icon: Icon,
  label,
  money,
  negative,
  tone,
  hint,
  change,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  money: Money[];
  /** Shown as money out (expenses): a minus in front. */
  negative?: boolean;
  /** Green when above nothing and red below; plain otherwise. */
  tone?: 'signed' | 'plain';
  hint?: string;
  change?: ReactNode;
  loading?: boolean;
}) {
  const short = useShortMoney();
  const shown = money.filter((m) => m.amount !== 0);
  return (
    <section className="bg-card flex min-w-0 flex-col gap-3 rounded-lg p-4">
      <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
        {hint ? <span className="text-muted-foreground/70 truncate text-xs">· {hint}</span> : null}
      </p>
      {loading ? (
        <span aria-hidden className="bg-muted block h-7 w-32 animate-pulse rounded" />
      ) : (
        <div className="flex min-w-0 flex-col gap-0.5">
          {shown.length === 0 ? (
            <span className="text-muted-foreground text-2xl font-semibold tabular-nums">0</span>
          ) : (
            shown.map((m, index) => {
              const value = negative ? { ...m, amount: -m.amount } : m;
              return (
                <span
                  key={m.currency}
                  dir="ltr"
                  className={cn(
                    'truncate text-start font-semibold tabular-nums',
                    index === 0 ? 'text-2xl' : 'text-muted-foreground text-base',
                    index === 0 && tone === 'signed' && value.amount > 0 && 'text-emerald-600 dark:text-emerald-400',
                    index === 0 && tone === 'signed' && value.amount < 0 && 'text-red-600 dark:text-red-400',
                  )}
                >
                  {short(value, tone === 'signed')}
                </span>
              );
            })
          )}
        </div>
      )}
      {change && !loading ? <div className="mt-auto">{change}</div> : null}
    </section>
  );
}
