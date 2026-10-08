'use client';

import { type CurrencyCode, type RateBoard, ratePairSchema } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Flag } from '@/components/flag';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FieldAlert } from '@/components/ui/field-alert';
import { errorKey, useMessage } from '@/lib/api/errors';
import { currencyFlag } from '@/lib/currency-flag';
import { promiseToast } from '@/lib/promise-toast';

import { formatMarket } from './format-market';
import { useMarketRates, useSetRates } from './queries';

type Pair = { buy: string; sell: string };

export interface RatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** The shop's day the rates are for (today). */
  date: string;
  /** The rows to fill: every traded currency, or just the one whose card was clicked. */
  currencies: CurrencyCode[];
  /** The day's board, so a rate already set starts filled in. */
  board: RateBoard;
}

/**
 * Setting today's rates, or changing one: buy and sell per currency as
 * "1 base = … currency" (core's rates.ts), with today's market rate beside
 * each as a guide. Nothing is checked until Save; then the first problem
 * shows, one at a time.
 */
export function RatesDialog({ open, onOpenChange, ...props }: RatesDialogProps) {
  const t = useTranslations('rates');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        {/* Mounted only while open, so each opening starts from the board. */}
        <RatesForm {...props} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function RatesForm({ workspaceId, date, currencies, board, onDone }: Omit<RatesDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }) {
  const t = useTranslations('rates');
  const columns = useTranslations('onboarding.rates');
  const message = useMessage();
  const base = board.base;
  const market = useMarketRates(base);
  const setRates = useSetRates(workspaceId);
  const [values, setValues] = useState<Record<string, Pair>>(() =>
    Object.fromEntries(currencies.map((code) => [code, board.rates[code] ?? { buy: '', sell: '' }])),
  );
  const [problem, setProblem] = useState<{ field: string; text: string } | null>(null);
  const one = currencies.length === 1 ? currencies[0] : null;

  const set = (currency: string, side: keyof Pair, value: string) => {
    setProblem(null);
    setValues((current) => ({ ...current, [currency]: { ...current[currency]!, [side]: value } }));
  };

  const save = () => {
    const rates = currencies.map((currency) => ({ currency, buy: values[currency]!.buy.trim(), sell: values[currency]!.sell.trim() }));
    for (const pair of rates) {
      const result = ratePairSchema.safeParse(pair);
      if (!result.success) {
        const issue = result.error.issues[0]!;
        return setProblem({ field: `${String(issue.path[0])}-${pair.currency}`, text: message(issue.message) });
      }
    }
    promiseToast(setRates.mutateAsync({ date, rates }), {
      loading: t('saving'),
      success: t('saved'),
      error: (error) => message(errorKey(error)),
      description: { loading: t('savingDescription'), success: t('savedDescription'), error: t('failedDescription') },
    }).then(onDone, () => undefined);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="flex min-h-0 flex-col"
    >
      <DialogTitle className="pe-10">{one ? t('titleOne', { currency: one }) : t('title')}</DialogTitle>
      <DialogDescription>{t('hint', { base })}</DialogDescription>

      {/* 1 base = · Market (a guide) · We buy · We sell */}
      <div className="text-muted-foreground mt-5 mb-2 grid grid-cols-[6rem_1fr_1fr_1fr] gap-2 px-1 text-xs">
        <span dir="ltr" className="text-start">
          1 {base} =
        </span>
        <span className="text-center">{columns('marketColumn')}</span>
        <span className="text-center">{columns('buy', { base })}</span>
        <span className="text-center">{columns('sell', { base })}</span>
      </div>
      <ul className="scrollbar-pill -mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1 pb-12">
        {currencies.map((currency) => {
          const marketRate = market.data?.rates[currency];
          return (
            <li key={currency} className="grid grid-cols-[6rem_1fr_1fr_1fr] items-center gap-2">
              <span className="bg-field flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium">
                <Flag code={currencyFlag(currency)} />
                {currency}
              </span>
              <span
                title={columns('marketFor', { base, currency })}
                className="bg-field/50 text-muted-foreground flex h-11 items-center justify-center rounded-xl px-2 text-sm"
              >
                <bdi dir="ltr" className="tabular-nums">
                  {marketRate ? formatMarket(marketRate) : '–'}
                </bdi>
              </span>
              {(['buy', 'sell'] as const).map((side) => (
                <div key={side} className="relative">
                  <input
                    value={values[currency]![side]}
                    onChange={(event) => set(currency, side, event.target.value)}
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="0.00"
                    aria-label={columns(side === 'buy' ? 'buyFor' : 'sellFor', { base, currency })}
                    className="bg-field focus-visible:bg-field-focus placeholder:text-muted-foreground h-11 w-full rounded-xl px-3 text-end text-sm tabular-nums outline-none"
                  />
                  <FieldAlert>{problem?.field === `${side}-${currency}` ? problem.text : null}</FieldAlert>
                </div>
              ))}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <DialogClose render={<Button type="button" variant="ghost" className="h-11 rounded-xl px-5" />}>{t('cancel')}</DialogClose>
        <Button type="submit" disabled={setRates.isPending} className="h-11 flex-1 rounded-xl font-semibold">
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
