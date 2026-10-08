'use client';

import type { Account } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

// The name setup suggests for a cash account, as each language writes it
// (messages: onboarding.accounts.cashName). Keep these in step with the files.
const SUGGESTED_CASH_NAMES = ['Cash {currency}', 'Lacag caddaan {currency}', 'نقد {currency}'];

/**
 * An account's name as shown. A cash account still called what setup
 * suggested ("Cash USD", in whatever language setup ran in) shows that
 * suggestion in today's language; any name someone typed shows as typed.
 */
export function useAccountLabel() {
  const t = useTranslations('onboarding.accounts');
  return useCallback(
    (account: Pick<Account, 'name' | 'type' | 'currency'>) =>
      account.type === 'cash' && SUGGESTED_CASH_NAMES.some((pattern) => pattern.replace('{currency}', account.currency) === account.name)
        ? t('cashName', { currency: account.currency })
        : account.name,
    [t],
  );
}
