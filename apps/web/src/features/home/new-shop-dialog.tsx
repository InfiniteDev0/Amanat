'use client';

import { parseAmount, type Workspace } from '@sarrif/core';
import { Loader, MapPin, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/features/auth/queries';
import { initialDraft, type OnboardingDraft, withCurrencies } from '@/features/onboarding/draft';
import { ConfirmOpening } from '@/features/onboarding/setup-wizard';
import AccountsStep from '@/features/onboarding/steps/accounts-step';
import { useAccountName } from '@/features/onboarding/use-account-name';
import { type StepProblem, validateAccounts, validateShop } from '@/features/onboarding/validate';
import { useCreateShop } from '@/features/workspaces/queries';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';

/**
 * "+ New shop": another shop of the business. Its name and place, then its
 * accounts and opening amounts, with the same rules as setting up the first
 * shop: "count your drawers first", totals per currency, and "Are these
 * opening amounts correct?" before it's saved, in one go. It trades the
 * business's currencies (the main shop's).
 */
export function NewShopDialog({ open, onOpenChange, main }: { open: boolean; onOpenChange: (open: boolean) => void; main: Workspace }) {
  const t = useTranslations('home.newShop');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>
        {/* Mounted fresh on every open: a new shop starts empty. */}
        {open ? <NewShopForm main={main} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewShopForm({ main, onDone }: { main: Workspace; onDone: () => void }) {
  const t = useTranslations('home.newShop');
  const tShop = useTranslations('onboarding.shop');
  const message = useMessage();
  const nameOf = useAccountName();
  const user = useSession().data;
  const create = useCreateShop();
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    withCurrencies(
      { ...initialDraft({ userId: user?.id ?? '', name: '', avatar: null, phone: '', termsNeeded: false, language: 'so' }), baseCurrency: main.baseCurrency },
      main.currencies,
    ),
  );
  const [problem, setProblem] = useState<StepProblem | null>(null);
  const [confirming, setConfirming] = useState(false);

  const update = (change: (draft: OnboardingDraft) => OnboardingDraft) => {
    setProblem(null);
    setDraft(change);
  };

  const next = () => {
    const blocked = validateShop(draft) ?? validateAccounts(draft);
    if (blocked) return setProblem(blocked);
    setConfirming(true);
  };

  const save = () => {
    setConfirming(false);
    const input = {
      name: draft.shopName.trim(),
      location: draft.location.trim(),
      accounts: draft.accounts
        .filter((account) => account.on)
        .map((account) => ({
          name: nameOf(account).trim(),
          type: account.type,
          currency: account.currency,
          provider: account.provider,
          openingBalance: account.opening.trim() ? (parseAmount(account.opening, account.currency) ?? 0) : 0,
        })),
    };
    promiseToast(create.mutateAsync(input), {
      loading: t('saving'),
      success: (shop) => t('created', { shop: shop.name }),
      error: (error) => message(errorKey(error)),
    }).then(onDone, () => undefined);
  };

  const shown = problem ? { field: problem.field, text: message(problem.message) } : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <TextField
          id="new-shop-name"
          label={tShop('name')}
          icon={Store}
          autoComplete="off"
          value={draft.shopName}
          onChange={(event) => update((d) => ({ ...d, shopName: event.target.value }))}
          error={shown?.field === 'shopName' ? shown.text : null}
        />
        <TextField
          id="new-shop-location"
          label={tShop('location')}
          icon={MapPin}
          autoComplete="off"
          value={draft.location}
          onChange={(event) => update((d) => ({ ...d, location: event.target.value }))}
        />
      </div>

      <AccountsStep draft={draft} update={update} problem={shown} goTo={() => undefined} />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone} className="h-11 rounded-xl">
          {t('cancel')}
        </Button>
        <Button type="button" onClick={next} disabled={create.isPending} className="h-11 rounded-xl px-5 font-semibold">
          {create.isPending ? <Loader className="animate-spin" /> : null}
          {t('create')}
        </Button>
      </DialogFooter>

      <ConfirmOpening draft={draft} open={confirming} onOpenChange={setConfirming} onConfirm={save} />
    </div>
  );
}
