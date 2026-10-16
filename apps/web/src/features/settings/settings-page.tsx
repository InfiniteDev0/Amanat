'use client';

import { type Account, addDays, fromMinor, parseAmount } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAccounts, useUpdateAccount } from '@/features/accounts/queries';
import { AmountBox, withCommas } from '@/features/profit/fields';
import { useAccountShort } from '@/features/profit/money-text';
import { formatMarket } from '@/features/rates/format-market';
import { useRatesForDays } from '@/features/rates/queries';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useUpdateWorkspace } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { formErrorKey, useMessage } from '@/lib/api/errors';

const INPUT = 'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-14 w-full rounded-xl px-4 text-lg outline-none disabled:opacity-60';

function Section({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="bg-[linear-gradient(to_right,#38ef7d,#11998e)] bg-clip-text text-base font-semibold text-transparent">{title}</h2>
        {help ? <p className="text-muted-foreground text-base">{help}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-lg font-semibold">{label}</span>
      {children}
    </label>
  );
}

const asText = (amount: number, currency: string) => withCommas(fromMinor(amount, currency as Account['currency']).toString());

/** The shop: name, where it is, when the day should be closed, and what counts as a large row. */
function ShopForm() {
  const t = useTranslations('settings');
  const message = useMessage();
  const { workspace, can } = useWorkspace();
  const update = useUpdateWorkspace(workspace.id);
  const owner = can('manage_shop');
  const [name, setName] = useState(workspace.name);
  const [location, setLocation] = useState(workspace.location);
  const [closingTime, setClosingTime] = useState(workspace.closingTime);
  const [limit, setLimit] = useState(asText(workspace.largeTransactionLimit, workspace.baseCurrency));
  const limitMinor = limit.trim() ? parseAmount(limit.replace(/,/g, ''), workspace.baseCurrency) : 0;
  const ready = owner && name.trim().length >= 2 && limitMinor !== null && !update.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    update.mutateAsync({ name: name.trim(), location: location.trim(), closingTime, largeTransactionLimit: limitMinor ?? 0 }).then(
      () => gooeyToast.success(t('saved')),
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Field label={t('name')}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!owner} className={INPUT} />
      </Field>
      <Field label={t('location')}>
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} disabled={!owner} placeholder={t('locationPlaceholder')} className={INPUT} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('closingTime')}>
          <input type="time" dir="ltr" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} disabled={!owner} className={`${INPUT} tabular-nums`} />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">{t('largeRow')}</span>
          <AmountBox label={t('largeRow')} currency={workspace.baseCurrency} value={limit} onChange={owner ? setLimit : () => undefined} />
        </div>
      </div>
      <p className="text-muted-foreground -mt-2 text-sm">{t('largeRowHelp')}</p>
      {owner ? (
        <Button type="submit" disabled={!ready} className="h-14 rounded-xl text-lg font-bold sm:w-60">
          {t('save')}
        </Button>
      ) : (
        <p className="text-muted-foreground text-base">{t('ownersOnly')}</p>
      )}
    </form>
  );
}

/** One account's opening amount, saved on its own. */
function OpeningRow({ account }: { account: Account }) {
  const t = useTranslations('settings');
  const message = useMessage();
  const short = useAccountShort();
  const { workspace, can } = useWorkspace();
  const update = useUpdateAccount(workspace.id);
  const [text, setText] = useState(asText(account.openingBalance, account.currency));
  const amount = text.trim() ? parseAmount(text.replace(/,/g, ''), account.currency) : 0;
  const changed = amount !== null && amount !== account.openingBalance;
  const owner = can('manage_accounts');

  const save = () => {
    if (amount === null) return;
    update.mutateAsync({ accountId: account.id, input: { openingBalance: amount } }).then(
      () => gooeyToast.success(t('openingSaved', { account: short(account) })),
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="text-lg font-bold sm:w-32">{short(account)}</span>
      <div className="flex-1">
        <AmountBox label={short(account)} currency={account.currency} value={text} onChange={owner ? setText : () => undefined} />
      </div>
      {owner ? (
        <Button type="button" variant="outline" onClick={save} disabled={!changed || update.isPending} className="h-14 rounded-xl px-6 text-base font-bold">
          {t('save')}
        </Button>
      ) : null}
    </li>
  );
}

/** Today's rate over the last two weeks, newest first. */
function RatesHistory() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { today } = useShopDay();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const results = useRatesForDays(workspace.id, days);
  return (
    <ul className="divide-border/60 flex flex-col divide-y">
      {days.map((date, index) => {
        const rate = results[index]?.data?.find((r) => r.currency === 'KES')?.buy;
        const loading = !results[index]?.data;
        return (
          <li key={date} className="flex items-baseline justify-between gap-4 py-2.5 text-base">
            <span>{new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</span>
            <span dir="ltr" className={rate ? 'font-semibold tabular-nums' : 'text-muted-foreground'}>
              {loading ? '…' : rate ? formatMarket(rate) : t('noRate')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Settings (Build Plan v4, 7.8), from the shop menu: the shop's name and
 * place, closing time and large-row limit; each account's opening amount;
 * today's rate over the last two weeks. Only Owners change them. Language,
 * theme and profile are in the shop menu.
 */
export function SettingsPage() {
  const t = useTranslations('settings');
  const { workspace } = useWorkspace();
  const accounts = useAccounts(workspace.id).data?.filter((a) => !a.archived) ?? [];
  // USD first, cash before the rest: the usual order of the four accounts.
  const ordered = [...accounts].sort((a, b) => (a.currency === b.currency ? (a.type === 'cash' ? -1 : 1) : a.currency === 'USD' ? -1 : 1));
  return (
    <div className="flex w-full max-w-3xl flex-col gap-10 p-4 lg:p-6">
      <Section title={t('shop')}>
        {/* Fresh fields when the shop changes. */}
        <ShopForm key={workspace.id} />
      </Section>
      <Section title={t('opening')} help={t('openingHelp')}>
        <ul className="flex flex-col gap-4">
          {ordered.map((account) => (
            <OpeningRow key={`${account.id}:${account.openingBalance}`} account={account} />
          ))}
        </ul>
      </Section>
      <Section title={t('rates')}>
        <RatesHistory />
      </Section>
    </div>
  );
}
