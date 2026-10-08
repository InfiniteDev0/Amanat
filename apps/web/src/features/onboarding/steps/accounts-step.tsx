'use client';

import { ACCOUNT_TYPES, type AccountType, type CurrencyCode, profileSchema } from '@sarrif/core';
import { Banknote, Check, Landmark, type LucideIcon, Plus, Smartphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Flag } from '@/components/flag';
import { Button } from '@/components/ui/button';
import { FieldAlert } from '@/components/ui/field-alert';
import { currencyFlag } from '@/lib/currency-flag';
import { useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import type { StepProps } from '.';
import { type DraftAccount, updateAccount } from '../draft';
import { useAccountName } from '../use-account-name';
import { StepHeader } from './step-header';

const TYPE_ICON: Record<AccountType, LucideIcon> = { cash: Banknote, mobile_money: Smartphone, bank: Landmark };

/**
 * Where the shop's money sits, and how much is in each place today. The
 * suggestions (cash per currency, M-Pesa for shillings) can be switched off
 * or renamed; anything else can be added. Balance = opening + entries.
 */
export default function AccountsStep({ draft, update, problem }: StepProps) {
  const t = useTranslations('onboarding.accounts');
  return (
    <div>
      <StepHeader title={t('title')} hint={t('hint')} />

      <div className="relative">
        <div className="text-muted-foreground mb-2 flex justify-between px-1 text-xs">
          <span>{t('account')}</span>
          <span>{t('opening')}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {draft.accounts.map((account) => (
            <AccountRow key={account.key} account={account} update={update} problem={problem} />
          ))}
        </ul>
        <FieldAlert>{problem?.field === 'accounts' ? problem.text : null}</FieldAlert>
      </div>

      <AddAccount currencies={draft.currencies} base={draft.baseCurrency} update={update} />
    </div>
  );
}

function AccountRow({ account, update, problem }: { account: DraftAccount } & Pick<StepProps, 'update' | 'problem'>) {
  const t = useTranslations('onboarding.accounts');
  const nameOf = useAccountName();
  const Icon = TYPE_ICON[account.type];
  const error =
    problem?.field === `name-${account.key}` || problem?.field === `opening-${account.key}` ? problem.text : null;
  const change = (patch: Partial<DraftAccount>) => update((d) => updateAccount(d, account.key, patch));

  return (
    <li className={cn('bg-field relative flex h-12 items-center gap-2.5 rounded-xl ps-2 pe-3', !account.on && 'opacity-50')}>
      {account.custom ? (
        <button
          type="button"
          onClick={() => update((d) => ({ ...d, accounts: d.accounts.filter((a) => a.key !== account.key) }))}
          aria-label={t('remove', { name: nameOf(account) })}
          className="text-muted-foreground hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg"
        >
          <X className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={account.on}
          aria-label={t('keep', { name: nameOf(account) })}
          onClick={() => change({ on: !account.on })}
          className="flex size-8 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              'text-primary-foreground flex size-5 items-center justify-center rounded-md transition-colors',
              account.on ? 'bg-primary' : 'bg-field-focus',
            )}
          >
            {account.on ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        </button>
      )}

      <Icon aria-hidden className="text-muted-foreground size-4 shrink-0" />
      <input
        value={nameOf(account)}
        onChange={(event) => change({ name: event.target.value })}
        disabled={!account.on}
        aria-label={t('name')}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />

      <input
        value={account.opening}
        onChange={(event) => change({ opening: event.target.value })}
        disabled={!account.on}
        inputMode="decimal"
        dir="ltr"
        placeholder="0"
        aria-label={t('openingFor', { name: nameOf(account) })}
        className="bg-field-focus placeholder:text-muted-foreground h-8 w-28 rounded-lg px-2.5 text-end text-sm tabular-nums outline-none"
      />
      <span className="flex w-14 shrink-0 items-center gap-1.5 text-xs font-medium">
        <Flag code={currencyFlag(account.currency)} />
        {account.currency}
      </span>

      <FieldAlert>{error}</FieldAlert>
    </li>
  );
}

/** "Add an account": a name, cash / mobile money / bank, and one of the shop's currencies. */
function AddAccount({
  currencies,
  base,
  update,
}: {
  currencies: CurrencyCode[];
  base: CurrencyCode | null;
  update: StepProps['update'];
}) {
  const t = useTranslations('onboarding.accounts');
  const message = useMessage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('mobile_money');
  const [currency, setCurrency] = useState<CurrencyCode | null>(base);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground mt-4 flex items-center gap-2 text-sm transition-colors"
      >
        <Plus className="size-4" />
        {t('add')}
      </button>
    );
  }

  const add = () => {
    const result = profileSchema.shape.name.safeParse(name);
    if (!name.trim()) return setError(message('validation.accountNameRequired'));
    if (!result.success) return setError(message(result.error.issues[0]?.message ?? 'validation.nameShort'));
    const code = currency ?? currencies[0];
    if (!code) return;
    update((d) => ({
      ...d,
      accounts: [
        ...d.accounts,
        { key: `custom-${crypto.randomUUID()}`, name: result.data, type, currency: code, provider: null, opening: '', on: true, custom: true },
      ],
    }));
    setName('');
    setOpen(false);
  };

  return (
    <div className="bg-field mt-4 flex flex-col gap-3 rounded-xl p-3">
      <div className="relative">
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), add())}
          placeholder={t('newName')}
          aria-label={t('newName')}
          autoComplete="off"
          className="bg-field-focus placeholder:text-muted-foreground h-10 w-full rounded-lg px-3 text-sm outline-none"
        />
        <FieldAlert>{error}</FieldAlert>
      </div>

      <div role="radiogroup" aria-label={t('type')} className="flex flex-wrap gap-2">
        {ACCOUNT_TYPES.map((value) => {
          const Icon = TYPE_ICON[value];
          return (
            <Choice key={value} selected={type === value} onClick={() => setType(value)}>
              <Icon className="size-4" />
              {t(`types.${value}`)}
            </Choice>
          );
        })}
      </div>

      <div role="radiogroup" aria-label={t('currency')} className="flex flex-wrap gap-2">
        {currencies.map((code) => (
          <Choice key={code} selected={(currency ?? currencies[0]) === code} onClick={() => setCurrency(code)}>
            <Flag code={currencyFlag(code)} />
            {code}
          </Choice>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 rounded-lg">
          {t('cancel')}
        </Button>
        <Button type="button" onClick={add} className="h-9 rounded-lg px-4 font-semibold">
          {t('addButton')}
        </Button>
      </div>
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors',
        selected ? 'bg-primary text-primary-foreground' : 'bg-field-focus hover:text-foreground text-muted-foreground',
      )}
    >
      {children}
    </button>
  );
}
