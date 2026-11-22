'use client';

import { businessDate, type Money, type Report, type ReportDay } from '@sarrif/core';
import { ArrowLeftRightIcon, ReceiptIcon, SmartphoneIcon, TrendingUpIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useReport } from '@/features/reports/queries';
import { Change, compareCurrency, type DayRange, figureOf, type Period, PeriodPicker, previousOf, rangeOf, StatCard, useRangeLabel } from '@/features/reports/period';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { Amounts } from './amounts';

/** The run's net as one figure in the base currency (each day at its own rate). */
function netInBase(report: Report | undefined, base: Money['currency']): Money[] {
  if (!report) return [];
  return [
    {
      amount: report.days.reduce((sum, day) => sum + (day.netInBase?.amount ?? 0), 0),
      currency: base,
    },
  ];
}

/** A day's figure in one cell: each currency on its line, green made, red cost; a dash for nothing. */
function Cell({ money, negative }: { money: Money[]; negative?: boolean }) {
  const shown = money.filter((m) => m.amount !== 0);
  if (shown.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {shown.map((m) => (
        <Amounts key={m.currency} money={[m]} negative={negative} />
      ))}
    </span>
  );
}

/**
 * Each day that had something, as a table: the day, then where its profit
 * came from (Exchange, Sallam), what it spent, and what it came to; the run
 * added up at the foot.
 */
function DayTable({ days, report }: { days: ReportDay[]; report: Report }) {
  const t = useTranslations('profit.calc');
  const locale = useLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const head = 'bg-card text-muted-foreground border-border sticky top-0 border-b px-4 py-2.5 text-xs font-medium whitespace-nowrap';
  return (
    <div className="bg-card scrollbar-pill overflow-x-auto rounded-lg">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className={cn(head, 'text-start')}>
              {t('day')}
            </th>
            <th scope="col" className={cn(head, 'text-end')}>
              {t('exchange')}
            </th>
            <th scope="col" className={cn(head, 'text-end')}>
              {t('sallam')}
            </th>
            <th scope="col" className={cn(head, 'text-end')}>
              {t('expenses')}
            </th>
            <th scope="col" className={cn(head, 'text-end')}>
              {t('netShort')}
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, n) => {
            const at = new Date(`${day.date}T12:00:00Z`);
            return (
              <tr key={day.date} className={cn(n % 2 === 0 && 'bg-muted/40 dark:bg-white/[0.025]')}>
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <span className="font-semibold">{weekday.format(at)}</span> <span className="text-muted-foreground">{date.format(at)}</span>
                  <span className="text-muted-foreground block text-xs">{t('rows', { count: day.rows })}</span>
                </td>
                <td className="px-4 py-3 text-end align-top">
                  <Cell money={day.exchange} />
                </td>
                <td className="px-4 py-3 text-end align-top">
                  <Cell money={day.sallam} />
                </td>
                <td className="px-4 py-3 text-end align-top">
                  <Cell money={day.expenses} negative />
                </td>
                <td className="px-4 py-3 text-end align-top font-semibold">
                  <Cell money={day.net} />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="border-border border-t px-4 py-3">{t('total')}</td>
            <td className="border-border border-t px-4 py-3 text-end align-top">
              <Cell money={report.exchange} />
            </td>
            <td className="border-border border-t px-4 py-3 text-end align-top">
              <Cell money={report.sallam} />
            </td>
            <td className="border-border border-t px-4 py-3 text-end align-top">
              <Cell money={report.expenses} negative />
            </td>
            <td className="border-border border-t px-4 py-3 text-end align-top">
              <Cell money={report.net} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Profit as a calculator, like Barista's: pick the run (Today, the last 7
 * days, this month, last month, or your own days) and it works out what the
 * shop made: net profit, exchange profit, Sallam profit and expenses, each
 * against the run before; then each day that had something, its profit by
 * where it came from (Exchange, Sallam), its expenses and its net.
 */
export function ProfitCalculator() {
  const t = useTranslations('profit.calc');
  const tReports = useTranslations('reports');
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const [period, setPeriod] = useState<Period>('today');
  const [custom, setCustom] = useState<DayRange>({ from: today, to: today });
  const range = rangeOf(period, today, custom);
  const before = previousOf(period, range);
  const label = useRangeLabel();
  const now = useReport(workspace.id, range.from, range.to);
  const prev = useReport(workspace.id, before.from, before.to);
  const data = now.data;
  const base = workspace.baseCurrency;
  const loading = !data;

  const compare = (pick: (report: Report) => Money[], upIsGood: boolean) => {
    if (!data || !prev.data) return null;
    const currency = compareCurrency(pick(data), pick(prev.data), base);
    return <Change now={figureOf(pick(data), currency)} before={figureOf(pick(prev.data), currency)} upIsGood={upIsGood} period={period} />;
  };

  const days = (data?.days ?? []).filter((day) => day.rows > 0 || day.expenses.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{label(range)}</p>
        </div>
        <PeriodPicker period={period} onPeriod={setPeriod} custom={custom} onCustom={setCustom} today={today} layoutId="profit-period" />
      </header>

      <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4 transition-opacity', now.isPlaceholderData && 'opacity-60')}>
        <StatCard
          icon={TrendingUpIcon}
          label={t('net')}
          hint={t('inBase', { currency: base })}
          money={netInBase(data, base)}
          tone="signed"
          loading={loading}
          change={compare((report) => netInBase(report, base), true)}
        />
        <StatCard icon={ArrowLeftRightIcon} label={t('exchange')} money={data?.exchange ?? []} tone="signed" loading={loading} change={compare((report) => report.exchange, true)} />
        <StatCard icon={SmartphoneIcon} label={t('sallam')} money={data?.sallam ?? []} tone="signed" loading={loading} change={compare((report) => report.sallam, true)} />
        <StatCard icon={ReceiptIcon} label={t('expenses')} money={data?.expenses ?? []} negative loading={loading} change={compare((report) => report.expenses, false)} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold">{t('byDay')}</h2>
          {data ? <span className="text-muted-foreground text-sm">{tReports('rowsCount', { count: data.rows })}</span> : null}
        </div>
        {loading ? (
          <div className="bg-card h-40 animate-pulse rounded-lg" />
        ) : days.length === 0 || !data ? (
          <p className="bg-card text-muted-foreground rounded-lg px-4 py-10 text-center text-sm">{t('nothing')}</p>
        ) : (
          <DayTable days={days} report={data} />
        )}
      </section>
    </div>
  );
}
