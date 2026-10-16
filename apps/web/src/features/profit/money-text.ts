'use client';

import { type Account, accountKind, formatMoney, type Money } from '@sarrif/core';
import { useLocale, useTranslations } from 'next-intl';

import { useAccountLabel } from '@/features/accounts/account-label';

/** The currency as people say it at the counter: $ or KSh. */
export function currencySymbol(currency: string) {
  return currency === 'USD' ? '$' : currency === 'KES' ? 'KSh' : currency;
}

/**
 * Money the way the client writes it: "20,160 $", "12,700 KSh", "+160 $",
 * "−20 $". Cents only when there are some. Latin digits, read left to right.
 */
export function useShortMoney() {
  const locale = useLocale();
  return (money: Money, signed = false) => {
    const digits = formatMoney({ ...money, amount: Math.abs(money.amount) }, { locale, showCurrency: false });
    const shown = digits.endsWith('.00') ? digits.slice(0, -3) : digits;
    const sign = signed ? (money.amount > 0 ? '+' : money.amount < 0 ? '−' : '') : money.amount < 0 ? '−' : '';
    return `${sign}${shown} ${currencySymbol(money.currency)}`;
  };
}

/** An account's short name: "$ Cash", "$ Sallam", "KSh Cash", "M-Pesa"; any other account by its own name. */
export function useAccountShort() {
  const t = useTranslations('account');
  const label = useAccountLabel();
  return (account: Account) => {
    const kind = accountKind(account);
    if (kind === 'cash_usd') return t('cashUsd');
    if (kind === 'salaam_bank') return t('sallam');
    if (kind === 'cash_kes') return t('cashKes');
    if (kind === 'mpesa') return t('mpesa');
    return label(account);
  };
}
