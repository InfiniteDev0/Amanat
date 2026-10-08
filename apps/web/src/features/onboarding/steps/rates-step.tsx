'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { FieldAlert } from '@/components/ui/field-alert';
import { formatMarket } from '@/features/rates/format-market';
import { useMarketRates } from '@/features/rates/queries';
import { currencyFlag } from '@/lib/currency-flag';

import type { StepProps } from '.';
import { type DraftRate, ratedOf } from '../draft';
import { StepHeader } from './step-header';

/**
 * Today's buy and sell for each currency, as "1 base = … currency" (the
 * convention in core's rates.ts: buy = the shop buys the base). Can be
 * skipped; Home then reminds them in the morning.
 *
 * Each currency shows today's market rate as a guide (mid-market, from a
 * public feed); the shop's own buy and sell stay theirs to type.
 */

export default function RatesStep({ draft, update, problem }: StepProps) {
  const t = useTranslations('onboarding.rates');
  const base = draft.baseCurrency;
  const rated = ratedOf(draft);
  const market = useMarketRates(rated.length ? base : null);
  const format = useFormatter();

  const set = (currency: string, side: keyof DraftRate, value: string) =>
    update((d) => {
      const pair = d.rates[currency as keyof typeof d.rates] ?? { buy: '', sell: '' };
      return { ...d, rates: { ...d.rates, [currency]: { ...pair, [side]: value } } };
    });

  if (!base || rated.length === 0) {
    return (
      <div>
        <StepHeader title={t('title')} hint={t('onlyBase', { currency: base ?? '' })} />
      </div>
    );
  }

  return (
    <div>
      <StepHeader title={t('title')} hint={t('hint', { base })} />
      {/* Currency · Market (read-only guide) · We buy · We sell */}
      <div className="text-muted-foreground mb-2 grid grid-cols-[6rem_1fr_1fr_1fr] gap-2 px-1 text-xs">
        <span dir="ltr" className="text-start">
          1 {base} =
        </span>
        <span className="text-center">{t('marketColumn')}</span>
        <span className="text-center">{t('buy', { base })}</span>
        <span className="text-center">{t('sell', { base })}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rated.map((currency) => {
          const pair = draft.rates[currency] ?? { buy: '', sell: '' };
          const marketRate = market.data?.rates[currency];
          return (
            <li key={currency} className="grid grid-cols-[6rem_1fr_1fr_1fr] items-center gap-2">
              <span className="bg-field flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium">
                <Flag code={currencyFlag(currency)} />
                {currency}
              </span>
              <span
                title={t('marketFor', { base, currency })}
                className="bg-field/50 text-muted-foreground flex h-11 items-center justify-center rounded-xl px-2 text-sm"
              >
                <bdi dir="ltr" className="tabular-nums">
                  {marketRate ? formatMarket(marketRate) : '–'}
                </bdi>
              </span>
              {(['buy', 'sell'] as const).map((side) => (
                <div key={side} className="relative">
                  <input
                    value={pair[side]}
                    onChange={(event) => set(currency, side, event.target.value)}
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="0.00"
                    aria-label={t(side === 'buy' ? 'buyFor' : 'sellFor', { base, currency })}
                    className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-11 w-full rounded-xl px-3 text-end text-sm tabular-nums outline-none"
                  />
                  <FieldAlert>{problem?.field === `${side}-${currency}` ? problem.text : null}</FieldAlert>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {market.data ? (
        <p className="text-muted-foreground mt-3 text-center text-xs">
          {t('credit', {
            source: market.data.source,
            updated: format.dateTime(new Date(market.data.updatedAt), { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </p>
      ) : null}
    </div>
  );
}
