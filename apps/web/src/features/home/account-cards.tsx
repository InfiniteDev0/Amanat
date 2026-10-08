'use client';

import { type CurrencyCode, formatMoney, valueFromBase } from '@sarrif/core';
import { WalletIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { MoneyText } from '@/components/money-text';
import { StatCard, StatCardSkeleton } from '@/components/stat-card';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { currencyFlag } from '@/lib/currency-flag';
import { ltr } from '@/lib/ltr';

import { useDaySummary } from './queries';


/** The number big, its currency code small beside it, kept left-to-right in Arabic. */
function Amount({ amount, currency }: { amount: number; currency: CurrencyCode }) {
  return (
    <bdi dir="ltr">
      <MoneyText money={{ amount, currency }} showCurrency={false} />
      <span className="ms-1.5 text-base font-medium opacity-70">{currency}</span>
    </bdi>
  );
}

/**
 * Home's money position for one day: the shop's total in the chosen currency,
 * then one card per account, plain (no colour): each leads with its
 * currency's flag; its balance is in its own currency, with what
 * came in and went out that day. A card opens that account's dialog
 * (balance, exchange, move).
 */
export function AccountCards({
  date,
  currency,
  onOpen,
}: {
  date: string | undefined;
  currency: CurrencyCode;
  /** A card was clicked: open that account's dialog. */
  onOpen: (accountId: string) => void;
}) {
  const t = useTranslations('home');
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const summary = useDaySummary(workspace.id, date);
  const plain = (amount: number, code: CurrencyCode) => ltr(formatMoney({ amount, currency: code }, { locale, showCurrency: false }));

  if (!summary.data) {
    return (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </section>
    );
  }

  const s = summary.data;
  const total = s.totalInBase === null ? null : valueFromBase(s.board, s.totalInBase, currency);
  // What's missing to show the total: the accounts' rates, then the chosen currency's.
  const missing = [...s.missingRates, ...(currency !== s.baseCurrency && !s.board.rates[currency] ? [currency] : [])];

  return (
    <section aria-label={t('accounts')} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        badge={t('total', { currency })}
        icon={<WalletIcon />}
        tone="neutral"
        value={total === null ? t('unknown') : <Amount amount={total} currency={currency} />}
        caption={total === null ? t('totalMissing', { currencies: [...new Set(missing)].join(', ') }) : t('totalCaption')}
      />
      {s.accounts.map(({ account, balance, todayIn, todayOut }) => (
        <StatCard
          key={account.id}
          badge={account.name}
          icon={<Flag code={currencyFlag(account.currency)} className="h-3" />}
          tone="plain"
          value={<Amount amount={balance} currency={account.currency} />}
          caption={t('accountDay', { in: plain(todayIn, account.currency), out: plain(todayOut, account.currency) })}
          action={{ label: t('openAccount', { account: account.name }), onClick: () => onOpen(account.id) }}
        />
      ))}
    </section>
  );
}
