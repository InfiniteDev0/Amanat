'use client';

import { Avatar } from '@heroui/react';
import { parseAmount, QUOTE_CURRENCY } from '@sarrif/core';
import { Coins, Globe, type LucideIcon, Phone, UserRound, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Flag } from '@/components/flag';
import { MoneyText } from '@/components/money-text';
import { toE164 } from '@/features/auth/schemas';
import { currencyFlag } from '@/lib/currency-flag';
import { DEFAULT_AVATAR_URL } from '@/lib/default-avatar';

import type { StepProps } from '.';
import { quotedOf } from '../draft';
import { useAccountName } from '../use-account-name';
import { OpeningTotals } from './accounts-step';

/**
 * The shop as a card, before it's saved: a header pill (photo, shop name,
 * location), the details as "label : value" rows, then the accounts (with
 * their totals) and today's rates in their own boxes. Each part has an Edit
 * link back to its step.
 */
export default function ReviewStep({ draft, goTo }: StepProps) {
  const t = useTranslations();
  const nameOf = useAccountName();
  const accounts = draft.accounts.filter((account) => account.on);
  const rates = quotedOf(draft).flatMap((currency) => {
    const perUsd = draft.rates[currency]?.trim();
    return perUsd ? [{ currency, perUsd }] : [];
  });

  return (
    <div className="flex flex-col gap-7 rounded-2xl px-2 py-2">
      <h1 id="setup-step-title" className="sr-only">
        {t('onboarding.review.title')}
      </h1>

      <div className="relative flex items-center gap-4 rounded-2xl bg-black/80 p-2 text-white">
        <Avatar className="size-10 shrink-0 rounded-xl">
          <Avatar.Image alt="" src={draft.avatar ?? DEFAULT_AVATAR_URL} className="object-cover" />
          <Avatar.Fallback className="bg-black/40" />
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold">{draft.shopName}</p>
          <p className="truncate text-sm font-semibold text-zinc-400">{draft.location || t('onboarding.review.noLocation')}</p>
        </div>
        <EditLink onClick={() => goTo('shop')} label={t('onboarding.review.editShop')} className="text-white/80 hover:text-white" />
      </div>

      <section className="flex flex-col gap-4 px-2 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('onboarding.review.you')}</h2>
          <EditLink onClick={() => goTo('profile')} label={t('onboarding.review.editProfile')} />
        </div>
        <dl className="flex flex-col gap-4">
          <Row icon={UserRound} label={t('onboarding.review.owner')}>
            {draft.name}
          </Row>
          <Row icon={Phone} label={t('onboarding.review.phone')}>
            <bdi dir="ltr" className="tabular-nums">
              {toE164(draft.phone) ?? draft.phone.number}
            </bdi>
          </Row>
          <Row icon={Globe} label={t('language.label')}>
            {t(`language.${draft.language}`)}
          </Row>
        </dl>
      </section>

      <section className="flex flex-col gap-4 px-2 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('onboarding.review.trade')}</h2>
          <EditLink onClick={() => goTo('currencies')} label={t('onboarding.review.editCurrencies')} />
        </div>
        <dl className="flex flex-col gap-4">
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
      </section>

      <Box title={t('onboarding.review.accounts')} onEdit={() => goTo('accounts')} editLabel={t('onboarding.review.editAccounts')}>
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
        <OpeningTotals accounts={accounts} />
      </Box>

      <Box title={t('onboarding.review.rates')} onEdit={() => goTo('rates')} editLabel={t('onboarding.review.editRates')}>
        {rates.length ? (
          rates.map((rate) => (
            <div key={rate.currency} dir="ltr" className="flex items-center justify-between gap-3 tabular-nums">
              <span className="text-muted-foreground flex items-center gap-2.5 text-xs font-medium tracking-wide uppercase">
                <Flag code={currencyFlag(rate.currency)} />1 {QUOTE_CURRENCY} = {rate.currency}
              </span>
              <span className="font-medium">{rate.perUsd}</span>
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{t('onboarding.review.noRates')}</p>
        )}
      </Box>
    </div>
  );
}

function EditLink({ onClick, label, className }: { onClick: () => void; label: string; className?: string }) {
  const t = useTranslations('onboarding.review');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={className ?? 'text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline'}
    >
      {t('edit')}
    </button>
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

/** A filled box with a title and its Edit link. */
function Box({ title, onEdit, editLabel, children }: { title: string; onEdit: () => void; editLabel: string; children: ReactNode }) {
  return (
    <section className="mx-2 rounded-2xl bg-black p-4 text-sm text-white">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <EditLink onClick={onEdit} label={editLabel} className="text-xs font-medium text-white/70 hover:text-white" />
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}
