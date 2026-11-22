'use client';

import { type AccountFlow, businessDate, formatMoney, type Money, type Report, reportCsv } from '@sarrif/core';
import { ArrowDownLeftIcon, ArrowUpRightIcon, DownloadIcon, ReceiptIcon, Share2Icon, TrendingUpIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Flag } from '@/components/flag';
import { useAccountLabel } from '@/features/accounts/account-label';
import { Amounts } from '@/features/profit/amounts';
import { useShortMoney } from '@/features/profit/money-text';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { currencyFlag } from '@/lib/currency-flag';
import { cn } from '@/lib/utils';

import { Change, compareCurrency, type DayRange, figureOf, type Period, PeriodPicker, previousOf, rangeOf, StatCard, useRangeLabel } from './period';
import { useReport } from './queries';

/** A titled block of the report, on a card. */
function Block({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card flex min-w-0 flex-col rounded-lg', className)}>
      <div className="flex items-baseline justify-between gap-4 px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Each currency on its own line, plain or signed; a dash for nothing. */
function Lines({ money, sign }: { money: Money[]; sign?: 'in' | 'out' }) {
  const short = useShortMoney();
  const shown = money.filter((m) => m.amount !== 0);
  if (shown.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col items-end">
      {shown.map((m) => (
        <span key={m.currency} dir="ltr" className={cn('tabular-nums', sign === 'in' && 'text-emerald-600 dark:text-emerald-400', sign === 'out' && 'text-red-600 dark:text-red-400')}>
          {short(sign === 'out' ? { ...m, amount: -m.amount } : m, sign !== undefined)}
        </span>
      ))}
    </span>
  );
}

const SOURCE_ORDER = ['exchange', 'expense', 'amanat', 'debt_payment', 'transfer'] as const;

/** Money in and out by what moved it: exchanges, expenses, amanat, debts, moves. */
function BySource({ report }: { report: Report }) {
  const t = useTranslations('reports');
  const rows = SOURCE_ORDER.map((source) => report.bySource.find((s) => s.source === source)).filter((row) => row !== undefined);
  return (
    <Block title={t('inOut')}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-4 pb-4 text-sm">{t('nothing')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th className="px-4 py-2 text-start font-medium">{t('kind')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('in')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('out')}</th>
            </tr>
          </thead>
          <tbody className="divide-foreground/5 divide-y">
            {rows.map((row) => (
              <tr key={row.source}>
                <td className="px-4 py-2.5 align-top font-medium">{t(`sources.${row.source}`)}</td>
                <td className="px-4 py-2.5 text-end align-top">
                  <Lines money={row.in} sign="in" />
                </td>
                <td className="px-4 py-2.5 text-end align-top">
                  <Lines money={row.out} sign="out" />
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="px-4 py-2.5 align-top">{t('total')}</td>
              <td className="px-4 py-2.5 text-end align-top">
                <Lines money={report.moneyIn} sign="in" />
              </td>
              <td className="px-4 py-2.5 text-end align-top">
                <Lines money={report.moneyOut} sign="out" />
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Block>
  );
}

/** Each account: what it had at the start, in, out, and what it had at the end. */
function Accounts({ flows }: { flows: AccountFlow[] }) {
  const t = useTranslations('reports');
  const label = useAccountLabel();
  const short = useShortMoney();
  const money = (amount: number, currency: Money['currency']) => short({ amount, currency });
  return (
    <Block title={t('accounts')}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs">
              <th className="px-4 py-2 text-start font-medium">{t('account')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('start')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('in')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('out')}</th>
              <th className="px-4 py-2 text-end font-medium">{t('end')}</th>
            </tr>
          </thead>
          <tbody className="divide-foreground/5 divide-y">
            {flows.map((flow) => (
              <tr key={flow.accountId}>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 font-medium">
                    <Flag code={currencyFlag(flow.currency)} className="h-2.5 shrink-0" />
                    {label(flow)}
                  </span>
                </td>
                <td dir="ltr" className="text-muted-foreground px-4 py-2.5 text-end tabular-nums">
                  {money(flow.start, flow.currency)}
                </td>
                <td dir="ltr" className={cn('px-4 py-2.5 text-end tabular-nums', flow.in > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                  {flow.in > 0 ? short({ amount: flow.in, currency: flow.currency }, true) : '—'}
                </td>
                <td dir="ltr" className={cn('px-4 py-2.5 text-end tabular-nums', flow.out > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                  {flow.out > 0 ? short({ amount: -flow.out, currency: flow.currency }, true) : '—'}
                </td>
                <td dir="ltr" className="px-4 py-2.5 text-end font-semibold tabular-nums">
                  {money(flow.end, flow.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}

/** A label and its amounts, one line of a side block. */
function Line({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="text-end">{children}</span>
    </li>
  );
}

/**
 * Reports: everything the shop's money did over the run picked (Today, the
 * last 7 days, this month, last month, or your own days). Money in and money
 * out (expenses included) against the run before, net profit and expenses;
 * in and out by kind; each account from start to end; what was bought and
 * sold; profit; expenses by kind; and the closings. CSV and WhatsApp.
 */
export function MoneyReport() {
  const t = useTranslations('reports');
  const tExpenses = useTranslations('expenses');
  const short = useShortMoney();
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState<DayRange>({ from: today, to: today });
  const range = rangeOf(period, today, custom);
  const before = previousOf(period, range);
  const label = useRangeLabel();
  const now = useReport(workspace.id, range.from, range.to);
  const prev = useReport(workspace.id, before.from, before.to);
  const data = now.data;
  const base = workspace.baseCurrency;
  const loading = !data;
  const list = (items: Money[], negative = false) => (items.length === 0 ? '0' : items.map((m) => short(negative ? { ...m, amount: -m.amount } : m, true)).join(' · '));

  const compare = (pick: (report: Report) => Money[], upIsGood: boolean) => {
    if (!data || !prev.data) return null;
    const currency = compareCurrency(pick(data), pick(prev.data), base);
    return <Change now={figureOf(pick(data), currency)} before={figureOf(pick(prev.data), currency)} upIsGood={upIsGood} period={period} />;
  };

  const download = () => {
    if (!data) return;
    const csv = reportCsv(data, (m) => `${formatMoney(m, { locale: 'en', showCurrency: false }).replace(/,/g, '')} ${m.currency}`, [
      t('csv.date'),
      t('csv.sallam'),
      t('csv.exchange'),
      t('csv.expenses'),
      t('csv.net'),
      t('csv.rows'),
      t('csv.difference'),
    ]);
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.name.replace(/[^\w-]+/g, '-')}-${range.from}-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const share = () => {
    if (!data) return;
    const text = [
      t('shareTitle', { shop: workspace.name, range: label(range) }),
      '',
      `${t('moneyIn')}: ${list(data.moneyIn)}`,
      `${t('moneyOut')}: ${list(data.moneyOut, true)}`,
      `${t('net')}: ${list(data.net)}`,
      `${t('expenses')}: ${list(data.expenses, true)}`,
      '',
      t('closedDays', { closed: data.closedDays, days: data.days.length }),
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const quiet = 'bg-foreground/5 hover:bg-foreground/10 flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40';

  return (
    <div className="flex w-full flex-col gap-6 px-6 pt-6 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{label(range)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} today={today} layoutId="report-period" />
          <button type="button" onClick={download} disabled={!data} className={quiet}>
            <DownloadIcon className="size-4" />
            {t('csvButton')}
          </button>
          <button type="button" onClick={share} disabled={!data} className={quiet}>
            <Share2Icon className="size-4" />
            {t('share')}
          </button>
        </div>
      </header>

      <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4 transition-opacity', now.isPlaceholderData && 'opacity-60')}>
        <StatCard icon={ArrowDownLeftIcon} label={t('moneyIn')} money={data?.moneyIn ?? []} loading={loading} change={compare((report) => report.moneyIn, true)} />
        <StatCard icon={ArrowUpRightIcon} label={t('moneyOut')} hint={t('moneyOutHint')} money={data?.moneyOut ?? []} negative loading={loading} change={compare((report) => report.moneyOut, false)} />
        <StatCard icon={TrendingUpIcon} label={t('net')} money={data?.net ?? []} tone="signed" loading={loading} change={compare((report) => report.net, true)} />
        <StatCard icon={ReceiptIcon} label={t('expenses')} money={data?.expenses ?? []} negative loading={loading} change={compare((report) => report.expenses, false)} />
      </div>

      {!data ? (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="bg-card h-72 animate-pulse rounded-lg" />
          <div className="bg-card h-72 animate-pulse rounded-lg" />
        </div>
      ) : (
        <div className={cn('grid items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] transition-opacity', now.isPlaceholderData && 'opacity-60')}>
          <div className="flex min-w-0 flex-col gap-3">
            <BySource report={data} />
            <Accounts flows={data.accountFlows} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Block title={t('profit')}>
              <ul className="divide-foreground/5 divide-y pb-1">
                <Line label={t('exchange')}>
                  <Amounts money={data.exchange} />
                </Line>
                <Line label={t('sallam')}>
                  <Amounts money={data.sallam} />
                </Line>
                <Line label={t('expenses')}>
                  <Amounts money={data.expenses} negative />
                </Line>
                <Line label={<span className="font-semibold">{t('net')}</span>}>
                  <Amounts money={data.net} />
                </Line>
              </ul>
            </Block>

            <Block title={t('exchanged')}>
              <ul className="divide-foreground/5 divide-y pb-1">
                <Line label={t('bought')}>
                  <Lines money={data.bought} />
                </Line>
                <Line label={t('sold')}>
                  <Lines money={data.sold} />
                </Line>
              </ul>
            </Block>

            <Block title={t('byCategory')}>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-muted-foreground px-4 pb-4 text-sm">{t('noExpenses')}</p>
              ) : (
                <ul className="divide-foreground/5 divide-y pb-1">
                  {data.expensesByCategory.map(({ category, total }) => (
                    <Line key={category} label={tExpenses(`categories.${category}`)}>
                      <Lines money={total} sign="out" />
                    </Line>
                  ))}
                </ul>
              )}
            </Block>

            <Block title={t('closings')}>
              <ul className="divide-foreground/5 divide-y pb-1">
                <Line
                  label={t('closedDays', {
                    closed: data.closedDays,
                    days: data.days.length,
                  })}
                >
                  {data.differences.length > 0 ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">{t('differences', { amount: list(data.differences) })}</span>
                  ) : (
                    <span className="text-muted-foreground">{t('noDifferences')}</span>
                  )}
                </Line>
              </ul>
            </Block>
          </div>
        </div>
      )}
    </div>
  );
}
