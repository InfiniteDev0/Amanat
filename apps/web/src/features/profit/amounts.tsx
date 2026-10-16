'use client';

import type { Money } from '@sarrif/core';

import { cn } from '@/lib/utils';

import { useShortMoney } from './money-text';

/** Per-currency totals (USD first). */
export function addUp(values: (Money | null)[]): Money[] {
  const totals = new Map<string, number>();
  for (const money of values) if (money) totals.set(money.currency, (totals.get(money.currency) ?? 0) + money.amount);
  return [...totals].map(([currency, amount]) => ({ amount, currency }) as Money).sort((a) => (a.currency === 'USD' ? -1 : 1));
}

/** Each currency, the client's way ("+140 $ · +299 KSh"); green made, red cost, unless plain. */
export function Amounts({ money, plain, negative }: { money: Money[]; plain?: boolean; negative?: boolean }) {
  const short = useShortMoney();
  const shown = money.filter((m) => m.amount !== 0);
  if (shown.length === 0) return <span className="text-muted-foreground">0</span>;
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-2">
      {shown.map((m, index) => {
        const value = negative ? { ...m, amount: -m.amount } : m;
        return (
          <span key={m.currency} className="flex items-baseline gap-2">
            {index > 0 ? <span aria-hidden className="bg-border mx-1 h-4 w-px self-center" /> : null}
            <span
              className={cn(
                'font-semibold tabular-nums',
                !plain && value.amount > 0 && 'text-emerald-600 dark:text-emerald-400',
                !plain && value.amount < 0 && 'text-red-600 dark:text-red-400',
              )}
            >
              {short(value, !plain || negative)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
