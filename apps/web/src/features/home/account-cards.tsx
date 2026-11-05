'use client';

import { sharesInBase, withReferenceRates } from '@sarrif/core';
import { useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountLabel } from '@/features/accounts/account-label';
import { useMarketRates } from '@/features/rates/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { currencyFlag } from '@/lib/currency-flag';
import { cn } from '@/lib/utils';

import { useDaySummary } from './queries';
import { SplitAmount } from './split-amount';

/** One colour per account, in order; it repeats after six. */
const COLOURS = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500'];

/** Thin diagonal stripes over a bar segment's colour. */
const STRIPES = { backgroundImage: 'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.22) 0 2px, transparent 2px 6px)' };

/**
 * Home's money position for one day. A striped bar on top splits the total
 * across the accounts, each valued in the base currency at the day's mid
 * rate (the market rate stands in for a rate not set yet). Under it one card
 * per account, base currency first and cash first within a currency: its
 * colour, its currency's flag and its name, and its balance in its own
 * currency (the share is shown by the bar only). With nothing to value yet
 * the bar is a plain track. A card opens that account's dialog (balance, move).
 */
export function AccountCards({
  date,
  onOpen,
  columns = 4,
}: {
  date: string | undefined;
  /** Cards to a row on wide screens: 4 across the page, 2 beside the shop page's quick actions. */
  columns?: 2 | 4;
  /** A card was clicked: open that account's dialog. */
  onOpen: (accountId: string) => void;
}) {
  const t = useTranslations('home');
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id, date);
  const label = useAccountLabel();
  const market = useMarketRates(workspace.baseCurrency).data;

  if (!summary.data) {
    return (
      <section className="flex flex-col gap-3">
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', columns === 4 && 'xl:grid-cols-4')}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  const { board } = summary.data;
  // Base currency first (USD, then the rest by code); within a currency, cash before the others.
  const accounts = [...summary.data.accounts].sort(
    (a, b) =>
      Number(a.account.currency !== board.base) - Number(b.account.currency !== board.base) ||
      a.account.currency.localeCompare(b.account.currency) ||
      Number(a.account.type !== 'cash') - Number(b.account.type !== 'cash'),
  );
  const shares = sharesInBase(
    withReferenceRates(board, market),
    accounts.map(({ account, balance }) => ({ amount: balance, currency: account.currency })),
  );
  const rows = accounts.map((position, index) => ({ ...position, colour: COLOURS[index % COLOURS.length]!, share: shares[index] ?? null }));
  const segments = rows.filter((row) => row.share);

  return (
    <section aria-label={t('accounts')} className="flex flex-col gap-3">
      <div role="img" aria-label={t('split')} className="flex h-2.5 w-full gap-1">
        {segments.length === 0 ? (
          <div className="bg-muted h-full flex-1 rounded-full" />
        ) : (
          segments.map((row) => (
            <div key={row.account.id} className={cn('h-full min-w-1.5 basis-0 rounded-full', row.colour)} style={{ ...STRIPES, flexGrow: row.share! }} />
          ))
        )}
      </div>

      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', columns === 4 && 'xl:grid-cols-4')}>
        {rows.map(({ account, balance, colour }) => (
          <button
            key={account.id}
            type="button"
            onClick={() => onOpen(account.id)}
            aria-label={t('openAccount', { account: label(account) })}
            className="bg-card hover:bg-card/70 focus-visible:ring-ring/50 flex min-w-0 flex-col gap-2 rounded-lg p-4 text-start transition-colors outline-none focus-visible:ring-3"
          >
            <span className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm">
              <span className={cn('size-2.5 shrink-0 rounded-full', colour)} aria-hidden />
              <Flag code={currencyFlag(account.currency)} className="h-3 shrink-0" />
              <span className="truncate">{label(account)}</span>
            </span>
            {/* The share of the total is the bar's job; the card is just the money. */}
            <SplitAmount amount={balance} currency={account.currency} className="truncate text-lg font-semibold" />

          </button>
        ))}
      </div>
    </section>
  );
}
