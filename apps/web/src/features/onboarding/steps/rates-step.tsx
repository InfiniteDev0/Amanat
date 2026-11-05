'use client';

import { QUOTE_CURRENCY } from '@sarrif/core';
import { useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { FieldAlert } from '@/components/ui/field-alert';
import { currencyFlag } from '@/lib/currency-flag';

import type { StepProps } from '.';
import { quotedOf } from '../draft';
import { StepHeader } from './step-header';

/**
 * Today's rate for each currency, the way the market says it, whatever the
 * base: "1 USD = [ 129 ] KSh", "1 USD = [ 4,000 ] SOS" (core's quotes.ts).
 * The base currency is only for totals. One number per currency for now
 * (whether the shop sets one price or two is still the client's to answer).
 * Can be skipped; Home then reminds them in the morning.
 */
export default function RatesStep({ draft, update, problem }: StepProps) {
  const t = useTranslations('onboarding.rates');
  const quoted = quotedOf(draft);

  const set = (currency: string, value: string) => update((d) => ({ ...d, rates: { ...d.rates, [currency]: value } }));

  if (quoted.length === 0) {
    return (
      <div>
        <StepHeader title={t('title')} hint={t('onlyBase', { currency: draft.currencies[0] ?? '' })} />
      </div>
    );
  }

  return (
    <div>
      <StepHeader title={t('title')} hint={t('hint')} />
      <ul className="flex flex-col gap-2">
        {quoted.map((currency) => (
          <li key={currency} dir="ltr" className="relative grid grid-cols-[auto_1fr_auto] items-center gap-2">
            <span className="flex h-11 items-center gap-2 px-1 text-sm font-medium">
              <Flag code={currencyFlag(QUOTE_CURRENCY)} />1 {QUOTE_CURRENCY} =
            </span>
            <input
              value={draft.rates[currency] ?? ''}
              onChange={(event) => set(currency, event.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              aria-label={t('rateFor', { currency })}
              className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-11 w-full rounded-xl px-3 text-end text-sm tabular-nums outline-none"
            />
            <span className="flex h-11 w-20 items-center gap-2 text-sm font-medium">
              <Flag code={currencyFlag(currency)} />
              {currency}
            </span>
            <FieldAlert>{problem?.field === `rate-${currency}` ? problem.text : null}</FieldAlert>
          </li>
        ))}
      </ul>
    </div>
  );
}
