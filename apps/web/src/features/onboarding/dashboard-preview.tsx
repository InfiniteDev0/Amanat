'use client';

import {
  type Account,
  businessDate,
  type DailyRate,
  daySummary,
  parseAmount,
  ratePairSchema,
  type Workspace,
} from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { WorkspaceFrame } from '@/components/layout/workspace-frame';
import { HomeScreen } from '@/features/home/home-screen';
import { PreviewSummaryContext } from '@/features/home/queries';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';
import { deviceTimeZone } from '@/lib/device-time-zone';

import { type OnboardingDraft, ratedOf } from './draft';
import { useAccountName } from './use-account-name';

const PREVIEW_ID = 'preview';

/**
 * The dashboard behind the setup wizard, built from the answers so far: the
 * shop's name in the bar, its accounts with their opening balances, and
 * the rates banner while any currency is without one. It is the real Home
 * screen, fed core's daySummary (the same function the backend uses) for a
 * stand-in shop with no records yet, instead of the backend's. When setup finishes, the real one takes over.
 */
export function DashboardPreview({ draft }: { draft: OnboardingDraft }) {
  const t = useTranslations('onboarding');
  const nameOf = useAccountName();
  const shopName = draft.shopName.trim() || t('preview.shopName');

  const { workspace, summary } = useMemo(() => {
    const timeZone = deviceTimeZone();
    const date = businessDate(timeZone);
    const base = draft.baseCurrency ?? draft.currencies[0] ?? 'USD';
    const workspace: Workspace = {
      id: PREVIEW_ID,
      name: shopName,
      location: draft.location,
      baseCurrency: base,
      currencies: draft.currencies.length ? draft.currencies : [base],
      timeZone,
      closingTime: '21:00',
      largeTransactionLimit: 0,
      ownerId: draft.userId,
      status: 'active',
      createdAt: '',
    };
    const accounts: Account[] = draft.accounts
      .filter((account) => account.on)
      .map((account) => ({
        id: account.key,
        workspaceId: PREVIEW_ID,
        name: nameOf(account),
        type: account.type,
        currency: account.currency,
        provider: account.provider,
        openingBalance: account.opening.trim() ? (parseAmount(account.opening, account.currency) ?? 0) : 0,
        minimumBalance: null,
        archived: false,
        createdAt: '',
      }));
    // Only rates that would pass the real check, so a half-typed one doesn't count.
    const rates: DailyRate[] = ratedOf(draft).flatMap((currency) => {
      const pair = draft.rates[currency];
      if (!pair || !ratePairSchema.safeParse({ currency, buy: pair.buy, sell: pair.sell }).success) return [];
      return [{ id: currency, workspaceId: PREVIEW_ID, currency, date, buy: pair.buy.trim(), sell: pair.sell.trim(), setBy: '', setAt: '' }];
    });
    return {
      workspace,
      summary: daySummary({ workspace, date, accounts, entries: [], rates, exchanges: [], expenses: [], amanats: [], debts: [], debtPayments: [] }),
    };
  }, [draft, nameOf, shopName]);

  return (
    <div aria-hidden className="contents">
      {/* The real Home, fed this summary instead of the backend's. */}
      <WorkspaceProvider workspace={workspace} role="owner">
        <PreviewSummaryContext value={summary}>
          <WorkspaceFrame workspaceId={PREVIEW_ID} shopName={shopName}>
            <HomeScreen />
          </WorkspaceFrame>
        </PreviewSummaryContext>
      </WorkspaceProvider>
    </div>
  );
}
