'use client';

import { COMMON_CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '@sarrif/core';
import { Coins, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectEmpty,
  MultiSelectGroup,
  MultiSelectInput,
  MultiSelectItem,
  MultiSelectLabel,
  MultiSelectList,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/motion/multi-select';
import { Flag } from '@/components/flag';
import { Field } from '@/components/ui/field';
import { FieldAlert } from '@/components/ui/field-alert';
import { currencyFlag } from '@/lib/currency-flag';

const COMMON = new Set<CurrencyCode>(COMMON_CURRENCIES);

/** Plain "contains" on the code or the name, ignoring case and accents. */
const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
const byCodeOrName = (value: string, query: string, keywords: string[]) => {
  const needle = fold(query.trim());
  return !needle || [value, ...keywords].some((text) => fold(text).includes(needle));
};

/**
 * The currencies the shop trades: any ISO currency, several at once, with a
 * search box at the top of the list (code or name). The usual ones come first. The first one picked
 * suggests the shop's base currency (sign-up, onboarding).
 */
export function CurrencyField({
  value,
  onChange,
  error,
}: {
  value: CurrencyCode[];
  onChange: (currencies: CurrencyCode[]) => void;
  /** Already translated. */
  error?: string | null;
}) {
  const t = useTranslations('currency');
  const locale = useLocale();
  const others = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'currency' });
    const collator = new Intl.Collator(locale);
    return CURRENCY_CODES.filter((code) => !COMMON.has(code)).sort((a, b) => collator.compare(names.of(a) ?? a, names.of(b) ?? b));
  }, [locale]);

  return (
    <Field data-invalid={Boolean(error)} className="relative">
      <MultiSelect value={value} onValueChange={(next) => onChange(next as CurrencyCode[])} filter={byCodeOrName}>
        <MultiSelectTrigger searchInPanel>
          <Coins aria-hidden className="text-muted-foreground size-4 shrink-0" />
          <MultiSelectValue placeholder={t('trade')} removeLabel={(code) => t('remove', { code })} />
        </MultiSelectTrigger>
        <MultiSelectContent>
          <div className="p-1.5 pb-0">
            <div className="bg-field flex h-10 items-center gap-2 rounded-lg px-3">
              <Search aria-hidden className="text-muted-foreground size-4 shrink-0" />
              <MultiSelectInput aria-label={t('search')} placeholder={t('search')} persistentPlaceholder className="h-full" />
            </div>
          </div>
          <MultiSelectList ariaLabel={t('trade')}>
            <MultiSelectGroup>
              <MultiSelectLabel>{t('common')}</MultiSelectLabel>
              {COMMON_CURRENCIES.map((code) => (
                <CurrencyItem key={code} code={code} />
              ))}
            </MultiSelectGroup>
            <MultiSelectGroup>
              <MultiSelectLabel>{t('all')}</MultiSelectLabel>
              {others.map((code) => (
                <CurrencyItem key={code} code={code} />
              ))}
            </MultiSelectGroup>
            <MultiSelectEmpty>{t('noResults')}</MultiSelectEmpty>
          </MultiSelectList>
        </MultiSelectContent>
      </MultiSelect>
      <FieldAlert>{error}</FieldAlert>
    </Field>
  );
}

function CurrencyItem({ code }: { code: CurrencyCode }) {
  const locale = useLocale();
  // Rendered in a portal after mount, so the browser's names can't mismatch the server's.
  // Browsers don't name the newest currencies yet (SLE, XCG, ZWG): show the code alone.
  const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
  const named = name && name !== code ? name : null;
  return (
    <MultiSelectItem value={code} textValue={code} keywords={named ? [named] : []}>
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="w-10 shrink-0 font-medium">{code}</span>
        <span className="text-muted-foreground truncate">{named}</span>
        <Flag code={currencyFlag(code)} className="ms-auto" />
      </span>
    </MultiSelectItem>
  );
}
