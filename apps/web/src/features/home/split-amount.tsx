'use client';

import { type CurrencyCode, formatMoney } from '@sarrif/core';
import { useLocale } from 'next-intl';

import { cn } from '@/lib/utils';

/** "128,461.23" → ["128,461", ".23"]: the cents are drawn lighter. */
export function splitDecimals(text: string, locale: string): [string, string] {
  const decimal = new Intl.NumberFormat(`${locale}-u-nu-latn`).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  const at = text.lastIndexOf(decimal);
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at)];
}

/** An amount with its cents lighter and its currency code small beside it, kept left-to-right in Arabic. */
export function SplitAmount({ amount, currency, className }: { amount: number; currency: CurrencyCode; className?: string }) {
  const locale = useLocale();
  const [whole, cents] = splitDecimals(formatMoney({ amount, currency }, { locale, showCurrency: false }), locale);
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {whole}
      <span className="text-muted-foreground font-normal">{cents}</span>
      <span className="text-muted-foreground ms-1.5 text-xs font-medium">{currency}</span>
    </bdi>
  );
}
