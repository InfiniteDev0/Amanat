'use client';

import { type Account, addDays, fromMinor, LANGUAGES, parseAmount } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { LogOutIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type ReactNode, useState } from 'react';

import { Flag } from '@/components/flag';
import { LOCALE_FLAG, useSwitchLocale } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { useAccountLabel } from '@/features/accounts/account-label';
import { useAccounts, useUpdateAccount } from '@/features/accounts/queries';
import { PasswordSection, ProfileSection } from '@/features/auth/account-settings-dialog';
import { useSession } from '@/features/auth/queries';
import { useSignOutAndLeave } from '@/features/auth/use-sign-out-and-leave';
import { formatMarket } from '@/features/rates/format-market';
import { useRatesForDays } from '@/features/rates/queries';
import { isTheme } from '@/features/theme/theme';
import { useTheme } from '@/features/theme/use-theme';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useUpdateWorkspace } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { currencyFlag } from '@/lib/currency-flag';
import { cn } from '@/lib/utils';

// Settings like Milo's: a plain title, a row of tabs with an underline that
// travels to the one picked, and settings that read left to right: what it
// is (and a line under it), then what it's set to.

const INPUT = 'bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-10 w-full rounded-lg px-3 text-sm outline-none disabled:opacity-60 sm:w-72';

/** One setting: its name and a hint on the left, its control on the right (stacked on a phone). */
function Row({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="border-foreground/8 flex flex-col gap-3 border-t py-5 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** A choice of a few, in one track (theme, language). */
function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="bg-foreground/5 flex flex-wrap gap-0.5 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
            value === option.value ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const asText = (amount: number, currency: Account['currency']) => (amount ? fromMinor(amount, currency).toString() : '');

/** The shop: name, where it is, when the day should be closed, and what counts as a large row. */
function ShopTab() {
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
    <form onSubmit={submit}>
      <Row label={t('name')} hint={t('nameHint')}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={!owner} aria-label={t('name')} className={INPUT} />
      </Row>
      <Row label={t('location')} hint={t('locationHint')}>
        <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} disabled={!owner} placeholder={t('locationPlaceholder')} aria-label={t('location')} className={INPUT} />
      </Row>
      <Row label={t('closingTime')} hint={t('closingTimeHint')}>
        <input type="time" dir="ltr" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} disabled={!owner} aria-label={t('closingTime')} className={cn(INPUT, 'tabular-nums sm:w-40')} />
      </Row>
      <Row label={t('largeRow')} hint={t('largeRowHelp')}>
        <div className="relative">
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="decimal"
            dir="ltr"
            disabled={!owner}
            aria-label={t('largeRow')}
            className={cn(INPUT, 'pe-14 text-end tabular-nums sm:w-48')}
          />
          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium">{workspace.baseCurrency}</span>
        </div>
      </Row>
      <div className="border-foreground/8 flex justify-end border-t pt-5">
        {owner ? (
          <Button type="submit" disabled={!ready} className="h-10 rounded-lg px-5 font-semibold">
            {t('save')}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">{t('ownersOnly')}</p>
        )}
      </div>
    </form>
  );
}

/** One account's opening amount: changing it is recorded (who, when, from and to). */
function OpeningRow({ account }: { account: Account }) {
  const t = useTranslations('settings');
  const message = useMessage();
  const label = useAccountLabel();
  const { workspace, can } = useWorkspace();
  const update = useUpdateAccount(workspace.id);
  const [text, setText] = useState(asText(account.openingBalance, account.currency));
  const amount = text.trim() ? parseAmount(text.replace(/,/g, ''), account.currency) : 0;
  const changed = amount !== null && amount !== account.openingBalance;
  const owner = can('manage_accounts');

  const save = () => {
    if (amount === null) return;
    update.mutateAsync({ accountId: account.id, input: { openingBalance: amount } }).then(
      () => gooeyToast.success(t('openingSaved', { account: label(account) })),
      (error) => gooeyToast.error(message(formErrorKey(error))),
    );
  };

  return (
    <Row
      label={
        <span className="flex items-center gap-2">
          <Flag code={currencyFlag(account.currency)} className="h-3" />
          {label(account)}
        </span>
      }
      hint={t('openingHint')}
    >
      <div className="relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputMode="decimal"
          dir="ltr"
          placeholder="0"
          disabled={!owner}
          aria-label={t('openingFor', { account: label(account) })}
          className={cn(INPUT, 'pe-14 text-end tabular-nums sm:w-48')}
        />
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium">{account.currency}</span>
      </div>
      {owner ? (
        <Button type="button" variant="outline" onClick={save} disabled={!changed || update.isPending} className="h-10 rounded-lg px-4">
          {t('save')}
        </Button>
      ) : null}
    </Row>
  );
}

function AccountsTab() {
  const t = useTranslations('settings');
  const { workspace } = useWorkspace();
  const accounts = useAccounts(workspace.id).data?.filter((a) => !a.archived) ?? [];
  // Dollars first, cash before the rest within a currency: the usual order of the four.
  const ordered = [...accounts].sort(
    (a, b) => Number(b.currency === 'USD') - Number(a.currency === 'USD') || a.currency.localeCompare(b.currency) || Number(a.type !== 'cash') - Number(b.type !== 'cash'),
  );
  return (
    <div>
      <p className="text-muted-foreground mb-5 text-sm">{t('openingHelp')}</p>
      {ordered.map((account) => (
        <OpeningRow key={`${account.id}:${account.openingBalance}`} account={account} />
      ))}
    </div>
  );
}

/** Today's rate over the last two weeks, newest first. */
function RatesTab() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const { workspace } = useWorkspace();
  const { today } = useShopDay();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  const results = useRatesForDays(workspace.id, days);
  return (
    <div>
      <p className="text-muted-foreground mb-5 text-sm">{t('rates')}</p>
      {days.map((date, index) => {
        const rate = results[index]?.data?.find((r) => r.currency === 'KES')?.buy;
        const loading = !results[index]?.data;
        return (
          <Row key={date} label={new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}>
            <span dir="ltr" className={rate ? 'text-sm font-semibold tabular-nums' : 'text-muted-foreground text-sm'}>
              {loading ? '…' : rate ? formatMarket(rate) : t('noRate')}
            </span>
          </Row>
        );
      })}
    </div>
  );
}

/** How the app looks for you: theme and language. */
function AppearanceTab() {
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const { switchTo } = useSwitchLocale();
  return (
    <div>
      <Row label={t('theme.label')} hint={t('settings.themeHint')}>
        <Segmented
          label={t('theme.label')}
          value={theme}
          onChange={(value) => {
            if (isTheme(value)) setTheme(value);
          }}
          options={[
            { value: 'light', label: t('theme.light') },
            { value: 'dark', label: t('theme.dark') },
          ]}
        />
      </Row>
      <Row label={t('language.label')} hint={t('settings.languageHint')}>
        <Segmented
          label={t('language.label')}
          value={locale}
          onChange={switchTo}
          options={LANGUAGES.map((code) => ({
            value: code,
            label: (
              <>
                <Flag code={LOCALE_FLAG[code]} />
                {t(`language.${code}`)}
              </>
            ),
          }))}
        />
      </Row>
    </div>
  );
}

/** You: name, phone, language, password; and signing out. */
function AccountTab() {
  const t = useTranslations();
  const user = useSession().data;
  const signOut = useSignOutAndLeave();
  if (!user) return null;
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <ProfileSection name={user.name} phone={user.phone} language={user.language} onSaved={() => undefined} />
      {user.hasPassword === false ? (
        <p className="bg-field text-muted-foreground rounded-lg px-4 py-3 text-sm">{t('me.googleOnly')}</p>
      ) : (
        <PasswordSection />
      )}
      <section className="border-foreground/8 flex flex-col gap-3 border-t pt-6">
        <div>
          <h3 className="text-sm font-semibold">{t('common.signOut')}</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">{t('settings.signOutHint')}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => signOut()} className="h-10 w-fit gap-2 rounded-lg px-4">
          <LogOutIcon className="size-4" />
          {t('common.signOut')}
        </Button>
      </section>
    </div>
  );
}

const TABS = ['shop', 'accounts', 'rates', 'appearance', 'account'] as const;
type Tab = (typeof TABS)[number];

/**
 * Settings: the shop (name, place, closing time, large-row limit), its
 * accounts' opening amounts, the last two weeks' rates, how the app looks
 * (theme, language), and your account. Only Owners change the shop's.
 */
export function SettingsPage() {
  const t = useTranslations('settings');
  const { workspace } = useWorkspace();
  const [tab, setTab] = useState<Tab>('shop');

  return (
    <div className="flex h-full w-full flex-col px-6 pt-6 lg:px-10">
      <h1 className="shrink-0 pb-5 text-2xl font-semibold">{t('title')}</h1>

      <div role="tablist" aria-label={t('title')} className="border-foreground/10 flex shrink-0 items-center gap-7 overflow-x-auto border-b">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('relative shrink-0 pb-3 text-sm transition-colors', tab === id ? 'text-foreground' : 'text-foreground/45 hover:text-foreground/75')}
          >
            {t(`tabs.${id}`)}
            {/* layoutId: the underline travels to the tab picked instead of blinking. */}
            {tab === id ? (
              <motion.span layoutId="settings-underline" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="bg-foreground absolute inset-x-0 -bottom-px h-0.5 rounded-full" />
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="scrollbar-pill min-h-0 flex-1 overflow-y-auto overscroll-contain py-6 pe-5 pb-10">
        {tab === 'shop' ? <ShopTab key={workspace.id} /> : null}
        {tab === 'accounts' ? <AccountsTab /> : null}
        {tab === 'rates' ? <RatesTab /> : null}
        {tab === 'appearance' ? <AppearanceTab /> : null}
        {tab === 'account' ? <AccountTab /> : null}
      </div>
    </div>
  );
}
