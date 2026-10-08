'use client';

import { type OnboardingInput, parseAmount, type WorkspaceMembership } from '@sarrif/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { setLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { errorKey, useMessage } from '@/lib/api/errors';
import { deviceTimeZone } from '@/lib/device-time-zone';
import { queryKeys } from '@/lib/query/keys';
import { promiseToast } from '@/lib/promise-toast';

import { clearDraft, type OnboardingDraft, ratedOf } from './draft';
import { clearSignupCurrencies } from './signup-currencies';
import { useAccountName } from './use-account-name';

/**
 * The wizard's one write: the draft becomes an OnboardingInput and is saved
 * in a single call (all or nothing). Then straight into the new shop, in the
 * language they picked.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const nameOf = useAccountName();
  const t = useTranslations('onboarding');
  const message = useMessage();

  const mutation = useMutation({
    mutationFn: (input: OnboardingInput) => api.onboarding.complete(input),
    onSuccess: ({ user, workspace }) => {
      queryClient.setQueryData(queryKeys.session, user);
      queryClient.setQueryData<WorkspaceMembership[]>(queryKeys.workspaces, (list = []) => [
        ...list,
        { workspace, role: 'owner' },
      ]);
      setLastWorkspaceId(workspace.id);
      clearDraft();
      clearSignupCurrencies();
      router.replace(`/w/${workspace.id}`, { locale: user.language });
    },
  });

  /** Saves the draft; `onDone` runs once the shop exists (closes an optional wizard). */
  const complete = (draft: OnboardingDraft, onDone?: () => void) => {
    const input: OnboardingInput = {
      profile: { name: draft.name.trim(), language: draft.language, avatar: draft.avatar },
      shop: {
        name: draft.shopName.trim(),
        location: draft.location.trim(),
        baseCurrency: draft.baseCurrency ?? draft.currencies[0] ?? 'USD',
        currencies: draft.currencies,
        // The shop's day is counted in the owner's time zone, as their device reports it.
        timeZone: deviceTimeZone(),
      },
      accounts: draft.accounts
        .filter((account) => account.on)
        .map((account) => ({
          name: nameOf(account).trim(),
          type: account.type,
          currency: account.currency,
          provider: account.provider,
          openingBalance: account.opening.trim() ? (parseAmount(account.opening, account.currency) ?? 0) : 0,
        })),
      rates: ratedOf(draft).flatMap((currency) => {
        const pair = draft.rates[currency];
        return pair?.buy.trim() && pair.sell.trim() ? [{ currency, buy: pair.buy.trim(), sell: pair.sell.trim() }] : [];
      }),
    };
    // One expanded toast follows the save: "Setting up your shop…" → "Ezary shop is ready".
    promiseToast(mutation.mutateAsync(input), {
      loading: t('saving'),
      success: ({ workspace }) => t('saved', { shop: workspace.name }),
      error: (error) => message(errorKey(error)),
      description: { loading: t('savingDescription'), success: t('savedDescription'), error: t('saveFailedDescription') },
    }).then(
      () => onDone?.(),
      () => undefined,
    );
  };

  return { complete, isPending: mutation.isPending || mutation.isSuccess };
}
