'use client';

import { formatMoney, type Money } from '@sarrif/core';
import { useLocale } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * An amount as text: "1,250.50 USD". Always left-to-right with Latin digits,
 * so it reads correctly inside Arabic, and tabular so columns line up.
 */
export function MoneyText({
  money,
  signed,
  showCurrency,
  className,
}: {
  money: Money;
  signed?: boolean;
  showCurrency?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  return (
    <bdi dir="ltr" className={cn('tabular-nums', className)}>
      {formatMoney(money, { locale, signed, showCurrency })}
    </bdi>
  );
}
