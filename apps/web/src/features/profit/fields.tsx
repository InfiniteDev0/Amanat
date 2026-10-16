'use client';

import type { Account } from '@sarrif/core';
import { BanknoteIcon, SmartphoneIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { currencySymbol, useAccountShort } from './money-text';

/**
 * Every account of the shop as a big button (notes for cash, a phone for
 * mobile money, the currency big), one picked. No dropdowns. Used by the
 * Move and Expense forms.
 */
export function AccountButtons({ label, accounts, value, onChange }: { label: string; accounts: Account[]; value: string | null; onChange: (id: string) => void }) {
  const short = useAccountShort();
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {accounts.map((account) => {
        const picked = account.id === value;
        const Icon = account.type === 'cash' ? BanknoteIcon : SmartphoneIcon;
        return (
          <button
            key={account.id}
            type="button"
            role="radio"
            aria-checked={picked}
            onClick={() => onChange(account.id)}
            className={cn(
              'flex min-h-14 items-center gap-2.5 rounded-xl px-3 py-2 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              picked ? 'bg-primary text-primary-foreground' : 'bg-field text-foreground hover:bg-field-focus',
            )}
          >
            <Icon className={cn('size-6 shrink-0', picked ? 'opacity-90' : 'text-muted-foreground')} aria-hidden />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-lg font-bold">{currencySymbol(account.currency)}</span>
              <span className={cn('truncate text-sm', picked ? 'opacity-90' : 'text-muted-foreground')}>{short(account)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "20160.5" → "20,160.5" while typing: commas in the whole part, the rest as typed. */
export function withCommas(text: string) {
  const clean = text.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = clean.split('.');
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rest.length ? `${grouped}.${rest.join('').slice(0, 2)}` : grouped;
}

/**
 * A big amount box: the currency at the start, digits left to right with
 * commas as you type. Empty, it shows `suggestion` in grey (the app's guess,
 * used until something is typed).
 */
export function AmountBox({
  label,
  currency,
  value,
  onChange,
  suggestion,
}: {
  label: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  suggestion?: string;
}) {
  return (
    // Left to right as a whole (the symbol, then the digits), in Arabic too.
    <label dir="ltr" className="relative block">
      <span className="sr-only">{label}</span>
      <span className="text-muted-foreground pointer-events-none absolute inset-y-0 start-4 flex items-center text-2xl font-semibold">{currencySymbol(currency)}</span>
      <input
        value={value}
        onChange={(event) => onChange(withCommas(event.target.value))}
        inputMode="decimal"
        autoComplete="off"
        placeholder={suggestion || '0'}
        className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground/70 h-16 w-full rounded-xl ps-16 pe-4 text-end text-3xl font-semibold tabular-nums outline-none"
      />
    </label>
  );
}
