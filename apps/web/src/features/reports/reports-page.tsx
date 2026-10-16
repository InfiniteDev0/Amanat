'use client';

import { addDays, formatMoney, type Money, monthStart, type ReportDay, reportCsv } from '@sarrif/core';
import { DownloadIcon, LockIcon, Share2Icon } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Amounts } from '@/features/profit/amounts';
import { useShortMoney } from '@/features/profit/money-text';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { useReport } from './queries';

const PERIODS = ['day', 'week', 'month', 'lastMonth'] as const;
type Period = (typeof PERIODS)[number];

/** The days a period covers, ending on the day the date control shows. */
function periodRange(period: Period, day: string): { from: string; to: string } {
  if (period === 'day') return { from: day, to: day };
  if (period === 'week') return { from: addDays(day, -6), to: day };
  if (period === 'month') return { from: monthStart(day), to: day };
  const lastDay = addDays(monthStart(day), -1);
  return { from: monthStart(lastDay), to: lastDay };
}

/** One big figure with its label, side by side with the others, a thin line between. */
function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-2xl font-bold">{children}</span>
    </div>
  );
}

/** One day: its date, how many rows, its net as a bar, then Sallam · Exchange · Expenses and whether it was closed. */
function DayRow({ day, widest, onOpen }: { day: ReportDay; widest: number; onOpen: () => void }) {
  const t = useTranslations('reports');
  const locale = useLocale();
  const money = useShortMoney();
  const date = new Date(`${day.date}T12:00:00Z`);
  const net = day.netInBase?.amount ?? 0;
  const width = widest > 0 ? Math.max(Math.round((Math.abs(net) / widest) * 100), net === 0 ? 0 : 3) : 0;
  const empty = day.rows === 0 && day.expenses.length === 0;
  return (
    <li>
      <button type="button" onClick={onOpen} className={cn('hover:bg-foreground/5 flex w-full flex-col gap-2 rounded-xl px-4 py-3.5 text-start transition-colors', empty && 'opacity-60')}>
        <span className="flex items-baseline justify-between gap-4">
          <span className="flex items-baseline gap-2">
            <span className="text-base font-bold">{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date)}</span>
            <span className="text-muted-foreground text-sm">{new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)}</span>
          </span>
          <span className="text-base">
            <Amounts money={day.net} />
          </span>
        </span>
        <span aria-hidden className="bg-foreground/5 block h-2 overflow-hidden rounded-full">
          <span className={cn('block h-full rounded-full', net >= 0 ? 'bg-[linear-gradient(to_right,#38ef7d,#11998e)]' : 'bg-red-500')} style={{ width: `${width}%` }} />
        </span>
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>{t('rowsCount', { count: day.rows })}</span>
          {day.sallam.length > 0 ? <span>{t('sallamShort', { amount: day.sallam.map((m) => money(m, true)).join(' · ') })}</span> : null}
          {day.exchange.length > 0 ? <span>{t('exchangeShort', { amount: day.exchange.map((m) => money(m, true)).join(' · ') })}</span> : null}
          {day.expenses.length > 0 ? <span>{t('expensesShort', { amount: day.expenses.map((m) => money({ ...m, amount: -m.amount }, true)).join(' · ') })}</span> : null}
          <span className="ms-auto">
            {day.closed ? (
              <span className={cn('inline-flex items-center gap-1 font-semibold', day.closed.differences.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
                <LockIcon className="size-3.5" aria-hidden />
                {day.closed.differences.length > 0 ? day.closed.differences.map((m) => money(m, true)).join(' · ') : t('closed')}
              </span>
            ) : (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 font-semibold text-orange-600 dark:text-orange-400">{t('notClosed')}</span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Reports (Build Plan v4, 7.5): one day, the last 7 days, this month or last
 * month, ending on the day the date control shows. The run's Sallam profit,
 * exchange profit, expenses and net at the top; how many days were closed and
 * how far the counts were off; each day as a line with its net as a bar (tap
 * it for that day's Profit page); expenses by category. Export to CSV and
 * Share to WhatsApp.
 */
export function ReportsPage() {
  const t = useTranslations('reports');
  const tExpenses = useTranslations('expenses');
  const locale = useLocale();
  const money = useShortMoney();
  const router = useRouter();
  const { workspace } = useWorkspace();
  const { day } = useShopDay();
  const [period, setPeriod] = useState<Period>('month');
  const { from, to } = periodRange(period, day);
  const query = useReport(workspace.id, from, to);
  const data = query.data;
  const widest = Math.max(0, ...(data?.days.map((d) => Math.abs(d.netInBase?.amount ?? 0)) ?? []));
  const rangeLabel = (() => {
    const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const a = format.format(new Date(`${from}T12:00:00Z`));
    return from === to ? a : `${a} – ${format.format(new Date(`${to}T12:00:00Z`))}`;
  })();
  const list = (items: Money[], negative = false) => (items.length === 0 ? '0' : items.map((m) => money(negative ? { ...m, amount: -m.amount } : m, true)).join(' · '));

  const download = () => {
    if (!data) return;
    const csv = reportCsv(data, (m) => `${formatMoney(m, { locale: 'en', showCurrency: false }).replace(/,/g, '')} ${m.currency}`, [t('csv.date'), t('csv.sallam'), t('csv.exchange'), t('csv.expenses'), t('csv.net'), t('csv.rows'), t('csv.difference')]);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.name.replace(/[^\w-]+/g, '-')}-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const share = () => {
    if (!data) return;
    const text = [
      t('shareTitle', { shop: workspace.name, range: rangeLabel }),
      '',
      `${t('sallam')}: ${list(data.sallam)}`,
      `${t('exchange')}: ${list(data.exchange)}`,
      `${t('expenses')}: ${list(data.expenses, true)}`,
      `${t('net')}: ${list(data.net)}`,
      '',
      t('closedDays', { closed: data.closedDays, days: data.days.length }),
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t('period')} className="bg-card flex flex-wrap gap-1 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === period}
              onClick={() => setPeriod(p)}
              className={cn('relative h-10 rounded-lg px-4 text-base font-semibold transition-colors', p === period ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {p === period ? <motion.span layoutId="report-period" className="bg-primary absolute inset-0 rounded-lg" transition={{ type: 'spring', duration: 0.35, bounce: 0 }} /> : null}
              <span className="relative">{t(`periods.${p}`)}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={download} disabled={!data} className="h-9 rounded-lg px-3 text-sm font-semibold">
            <DownloadIcon data-icon="inline-start" />
            {t('csvButton')}
          </Button>
          <Button type="button" onClick={share} disabled={!data} className="h-9 rounded-lg bg-[#25D366] px-3 text-sm font-semibold text-white hover:bg-[#1ebe5a]">
            <Share2Icon data-icon="inline-start" />
            {t('share')}
          </Button>
        </div>
      </header>

      <p className="text-muted-foreground -mt-3 text-base">{rangeLabel}</p>

      {!data ? (
        <div className="flex flex-col gap-3">
          <div className="bg-card h-20 animate-pulse rounded-xl" />
          <div className="bg-card h-64 animate-pulse rounded-xl" />
        </div>
      ) : (
        <div className={cn('flex flex-col gap-8 transition-opacity', query.isPlaceholderData && 'opacity-60')}>
          <section className="grid grid-cols-2 gap-x-6 gap-y-5 lg:flex lg:flex-wrap lg:items-start lg:gap-x-0">
            {[
              { key: 'sallam', node: <Amounts money={data.sallam} /> },
              { key: 'exchange', node: <Amounts money={data.exchange} /> },
              { key: 'expenses', node: <Amounts money={data.expenses} negative /> },
              { key: 'net', node: <Amounts money={data.net} /> },
            ].map((item, index) => (
              <div key={item.key} className="flex items-stretch">
                {index > 0 ? <span aria-hidden className="bg-border mx-6 hidden w-px lg:block" /> : null}
                <Figure label={t(item.key as 'sallam')}>{item.node}</Figure>
              </div>
            ))}
          </section>

          <p className="text-base">
            <span className="font-semibold">{t('closedDays', { closed: data.closedDays, days: data.days.length })}</span>
            {data.differences.length > 0 ? <span className="ms-2 font-semibold text-red-600 dark:text-red-400">{t('differences', { amount: data.differences.map((m) => money(m, true)).join(' · ') })}</span> : null}
          </p>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <section className="flex flex-col gap-2">
              <h2 className="bg-[linear-gradient(to_right,#38ef7d,#11998e)] bg-clip-text text-base font-semibold text-transparent">{t('byDay')}</h2>
              <ul className="-mx-4 flex flex-col">
                {data.days.map((d) => (
                  <DayRow key={d.date} day={d} widest={widest} onOpen={() => router.push(`/w/${workspace.id}/profit?day=${d.date}`)} />
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="bg-[linear-gradient(to_right,#38ef7d,#11998e)] bg-clip-text text-base font-semibold text-transparent">{t('byCategory')}</h2>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-muted-foreground text-base">{t('noExpenses')}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {data.expensesByCategory.map(({ category, total }) => (
                    <li key={category} className="flex items-baseline justify-between gap-4 text-base">
                      <span className="font-medium">{tExpenses(`categories.${category}`)}</span>
                      <Amounts money={total} negative />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
