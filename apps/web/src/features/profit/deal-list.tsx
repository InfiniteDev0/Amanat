'use client';

import { dealResult, dealSection, type DealRow, type Money } from '@sarrif/core';
import { useLocale, useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { addUp, Amounts } from './amounts';
import { useShortMoney } from './money-text';

/** A deal as one line of words: "Bought 1,000 $ at 127 → paid 127,000 KSh", "Sold 20,000 $ cash at 0.8% → Sallam 20,160 $". */
export function useDealSentence() {
  const t = useTranslations('profit');
  const money = useShortMoney();
  return ({ deal, profit }: DealRow) => {
    const result = dealResult(deal);
    if (dealSection(deal) === 'sallam') {
      const percent = deal.percent ?? (result?.percent ? String(Math.abs(Number(result.percent))) : '');
      const what = { amount: money({ amount: deal.amountOut, currency: deal.currencyOut }), percent };
      const bought = (profit?.amount ?? 0) < 0;
      return `${bought ? t('rowBought', what) : t('rowSold', what)} → ${t('rowSallam', { amount: money({ amount: deal.amountIn, currency: deal.currencyIn }) })}`;
    }
    const boughtUsd = deal.currencyIn === 'USD';
    const dollars = money({ amount: boughtUsd ? deal.amountIn : deal.amountOut, currency: 'USD' });
    const shillings = money({ amount: boughtUsd ? deal.amountOut : deal.amountIn, currency: 'KES' });
    const rate = Number(deal.customerRate ?? result?.rate ?? 0).toFixed(2);
    return boughtUsd ? `${t('rowBoughtUsd', { amount: dollars, rate })} → ${t('rowPaid', { amount: shillings })}` : `${t('rowSoldUsd', { amount: dollars, rate })} → ${t('rowGot', { amount: shillings })}`;
  };
}

/**
 * A day's deals, as Barista's results: one striped row each (when, what was
 * done, the customer, what it made), the profit added up at the foot.
 */
export function DealList({ rows, empty, loading }: { rows: DealRow[]; empty: string; loading?: boolean }) {
  const t = useTranslations('profit');
  const locale = useLocale();
  const sentence = useDealSentence();
  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-card h-14 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <p className="text-muted-foreground px-1 py-6 text-sm">{empty}</p>;
  const total: Money[] = addUp(rows.map((row) => row.profit));
  return (
    <div className="flex min-w-0 flex-col">
      <ul className="flex flex-col">
        {rows.map((row, n) => (
          <li key={row.deal.id} className={cn('flex items-center gap-4 rounded-lg px-3 py-3 text-sm', n % 2 === 0 && 'bg-muted/40 dark:bg-white/[0.025]')}>
            <span className="text-muted-foreground w-14 shrink-0 tabular-nums">
              {new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(row.deal.createdAt))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{sentence(row)}</span>
              {row.deal.customer ? <span className="text-muted-foreground block truncate text-xs">{row.deal.customer}</span> : null}
            </span>
            <span className="shrink-0 text-end">{row.profit ? <Amounts money={[row.profit]} /> : <span className="text-muted-foreground">—</span>}</span>
          </li>
        ))}
      </ul>
      <div className="border-border mt-2 flex items-baseline justify-between gap-3 border-t px-3 pt-3 text-sm">
        <span className="text-muted-foreground">{t('total', { count: rows.length })}</span>
        <span className="font-semibold">
          <Amounts money={total} />
        </span>
      </div>
    </div>
  );
}
