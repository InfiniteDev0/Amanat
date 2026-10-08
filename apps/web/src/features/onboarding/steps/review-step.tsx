'use client';

import { Avatar } from '@heroui/react';
import { parseAmount } from '@sarrif/core';
import { Coins, Globe, type LucideIcon, UserRound, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Flag } from '@/components/flag';
import { MoneyText } from '@/components/money-text';
import { currencyFlag } from '@/lib/currency-flag';
import { DEFAULT_AVATAR_URL } from '@/lib/default-avatar';

import type { StepProps } from '.';
import { ratedOf } from '../draft';
import { useAccountName } from '../use-account-name';

/**
 * The shop as a card, before it's saved: a header pill (photo, shop name,
 * location) with two layers stacked under it, the details as
 * "label : value" rows, then the accounts and today's rates in their own
 * boxes. Clean on purpose: no edit buttons, Back changes things.
 */
export default function ReviewStep({ draft }: StepProps) {
  const t = useTranslations();
  const nameOf = useAccountName();
  const accounts = draft.accounts.filter((account) => account.on);
  const rates = ratedOf(draft).flatMap((currency) => {
    const pair = draft.rates[currency];
    return pair?.buy.trim() && pair.sell.trim() ? [{ currency, ...pair }] : [];
  });

  return (
    <div className="flex flex-col gap-7  px-2 py-2 rounded-2xl ">
      <h1 id="setup-step-title" className="sr-only">
        {t('onboarding.review.title')}
      </h1>

      {/* Header pill with two lilac layers stacked under it: solid, no blur. */}
      <div className="relative  pb-5">
        <div className="relative flex items-center gap-4 rounded-2xl  bg-black/80 p-2 text-white">
          <Avatar className="size-10 shrink-0 rounded-xl">
            <Avatar.Image alt="" src={draft.avatar ?? DEFAULT_AVATAR_URL} className="object-cover" />
            <Avatar.Fallback className="bg-black/40" />
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{draft.shopName}</h1>
            <h1 className="truncate text-sm text-zinc-600 font-semibold">{draft.location || t('onboarding.review.noLocation')}</h1> 
            {/* should be email instead of location */}
          </div>
        </div>
      </div>

      <dl className="flex flex-col gap-4 px-2 text-sm">
        <Row icon={UserRound} label={t('onboarding.review.owner')}>
          {draft.name}
        </Row>
        <Row icon={Globe} label={t('language.label')}>
          {t(`language.${draft.language}`)}
        </Row>
        <Row icon={Coins} label={t('onboarding.review.base')}>
          <span className="flex items-center gap-2">
            {draft.baseCurrency ? <Flag code={currencyFlag(draft.baseCurrency)} /> : null}
            {draft.baseCurrency}
          </span>
        </Row>
        <Row icon={Wallet} label={t('onboarding.review.currencies')}>
          {draft.currencies.join(', ')}
        </Row>
      </dl>

      <Box title={t('onboarding.review.accounts')}>
        {accounts.map((account) => (
          <div key={account.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Flag code={currencyFlag(account.currency)} />
              <span className="truncate">{nameOf(account)}</span>
            </span>
            <MoneyText
              money={{ amount: parseAmount(account.opening || '0', account.currency) ?? 0, currency: account.currency }}
              className="font-medium"
            />
          </div>
        ))}
      </Box>

      <Box title={t('onboarding.review.rates')}>
        {rates.length ? (
          rates.map((rate) => (
            <div key={rate.currency} dir="ltr" className="flex items-center justify-between gap-3 tabular-nums">
              <span className="text-muted-foreground flex items-center gap-2.5 text-xs font-medium tracking-wide uppercase">
                <Flag code={currencyFlag(rate.currency)} />
                1 {draft.baseCurrency} = {rate.currency}
              </span>
              <span className="font-medium">
                {rate.buy} / {rate.sell}
              </span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{t('onboarding.review.noRates')}</p>
        )}
      </Box>
    </div>
  );
}

/** Icon, a muted label, then ": value" in bold, like the reference card. */
function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_8.5rem_1fr] items-center gap-2">
      <Icon aria-hidden className="text-muted-foreground size-4" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-2 font-semibold">
        <span aria-hidden className="text-muted-foreground font-normal">
          :
        </span>
        <span className="min-w-0 truncate">{children}</span>
      </dd>
    </div>
  );
}

/** A filled box with a title, like the reference's "About". */
function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-black rounded-2xl mx-2 p-4 text-sm">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
