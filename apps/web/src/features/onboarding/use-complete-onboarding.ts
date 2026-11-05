'use client';

import { type OnboardingInput, parseAmount, type WorkspaceMembership } from '@sarrif/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { toE164 } from '@/features/auth/schemas';
import { setLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { errorKey, useMessage } from '@/lib/api/errors';
import { deviceTimeZone } from '@/lib/device-time-zone';
import { queryKeys } from '@/lib/query/keys';
import { promiseToast } from '@/lib/promise-toast';

import { clearDraft, type OnboardingDraft, quotedOf } from './draft';
import { useAccountName } from './use-account-name';

/**
 * Open my shop: the draft as one OnboardingInput, saved in ONE call (one
 * database transaction on the real backend: the profile with the phone and
 * the terms, the main shop, its accounts and opening amounts, today's
 * rates). All or nothing; a double click gets the same shop. Then straight
 * into the new shop, in the language they picked. If it fails, they stay on
 * the review with a translated error and can try again.
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
        ...list.filter((m) => m.workspace.id !== workspace.id),
        { workspace, role: 'owner' },
      ]);
      queryClient.setQueryData(queryKeys.onboardingProgress, null);
      setLastWorkspaceId(workspace.id);
      clearDraft();
      router.replace(`/w/${workspace.id}`, { locale: user.language });
    },
  });

  /** Saves the draft; `onDone` runs once the shop exists (closes an optional wizard). */
  const complete = (draft: OnboardingDraft, onDone?: () => void) => {
    const input: OnboardingInput = {
      profile: {
        name: draft.name.trim(),
        language: draft.language,
        avatar: draft.avatar,
        phone: toE164(draft.phone) ?? '',
        // Google sign-ups agree here; everyone else did on Sign up.
        acceptTerms: draft.termsNeeded ? true : undefined,
      },
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
      // "1 USD = 129 KSh", as typed; skipped ones are left out.
      rates: quotedOf(draft).flatMap((currency) => {
        const perUsd = draft.rates[currency]?.trim();
        return perUsd ? [{ currency, perUsd }] : [];
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
