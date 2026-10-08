'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import type { DraftAccount } from './draft';

/** An account's name as shown and saved: typed, or the suggestion's ("Cash USD", "M-Pesa"). */
export function useAccountName() {
  const t = useTranslations('onboarding.accounts');
  return useCallback(
    (account: Pick<DraftAccount, 'name' | 'type' | 'currency' | 'provider'>) =>
      account.name ?? (account.type === 'cash' ? t('cashName', { currency: account.currency }) : (account.provider ?? account.currency)),
    [t],
  );
}
