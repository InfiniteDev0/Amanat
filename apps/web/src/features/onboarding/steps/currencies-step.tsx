'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CurrencyField } from '@/components/currency-field';
import { Flag } from '@/components/flag';
import { FieldAlert } from '@/components/ui/field-alert';
import { currencyFlag } from '@/lib/currency-flag';
import { cn } from '@/lib/utils';

import type { StepProps } from '.';
import { withBase, withCurrencies } from '../draft';
import { StepHeader } from './step-header';

/**
 * What the shop trades, and which of those it counts in (the base). Rates are
 * set against the base; it's also the currency of totals and profit.
 */
export default function CurrenciesStep({ draft, update, problem }: StepProps) {
  const t = useTranslations('onboarding.currencies');
  return (
    <div>
      <StepHeader title={t('title')} hint={t('hint')} />
      <div className="flex flex-col gap-6">
        <CurrencyField
          value={draft.currencies}
          onChange={(currencies) => update((d) => withCurrencies(d, currencies))}
          error={problem?.field === 'currencies' ? problem.text : null}
        />

        {draft.currencies.length > 0 ? (
          <div className="relative">
            <p className="text-sm font-medium">{t('base')}</p>
            <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">{t('baseHint')}</p>
            <div role="radiogroup" aria-label={t('base')} className="flex flex-wrap gap-2">
              {draft.currencies.map((code) => {
                const selected = draft.baseCurrency === code;
                return (
                  <button
                    key={code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update((d) => withBase(d, code))}
                    className={cn(
                      'flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors',
                      selected ? 'bg-primary text-primary-foreground' : 'bg-field hover:bg-field-focus',
                    )}
                  >
                    <Flag code={currencyFlag(code)} />
                    {code}
                    {selected ? <Check className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
            <FieldAlert>{problem?.field === 'base' ? problem.text : null}</FieldAlert>
          </div>
        ) : null}
      </div>
    </div>
  );
}
