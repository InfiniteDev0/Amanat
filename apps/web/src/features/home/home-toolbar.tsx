'use client';

import type { CurrencyCode } from '@sarrif/core';
import { CalendarIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Flag } from '@/components/flag';
import {
  DateRangePicker,
  DateRangePickerCalendar,
  DateRangePickerContent,
  DateRangePickerGrid,
  DateRangePickerHeader,
  DateRangePickerTrigger,
} from '@/components/motion/date-range-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/motion/select';
import { currencyFlag } from '@/lib/currency-flag';

const PILL_CLASS =
  'bg-card hover:bg-card/70 aria-expanded:bg-card/70 flex h-11 items-center gap-3 rounded-xl px-4 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** "8 October 2026", for a shop's yyyy-mm-dd day (read as a calendar date, not a moment). */
function useDayLabel() {
  const locale = useLocale();
  const format = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  );
  return (day: string) => format.format(new Date(`${day}T00:00:00Z`));
}

/**
 * Above Home's figures: the day they're for (today unless picked in the
 * calendar; only days that have happened) and, at the other end, the currency the total is shown in.
 */
export function HomeToolbar({
  day,
  today,
  onDayChange,
  currency,
  currencies,
  onCurrencyChange,
}: {
  day: string;
  today: string;
  onDayChange: (day: string) => void;
  currency: CurrencyCode;
  currencies: CurrencyCode[];
  onCurrencyChange: (currency: CurrencyCode) => void;
}) {
  const t = useTranslations('home');
  const locale = useLocale();
  const dayLabel = useDayLabel();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3">
      {/* beui's date range picker, used for one day: a click picks that day and closes it. */}
      <DateRangePicker
        value={{ from: day, to: day }}
        onValueChange={(range) => {
          if (range?.from) onDayChange(range.from);
          setOpen(false);
        }}
        open={open}
        onOpenChange={setOpen}
        max={today}
        locale={locale}
        label={t('pickDay')}
        showSummary={false}
      >
        <DateRangePickerTrigger aria-label={t('pickDay')} className={`${PILL_CLASS} h-11 min-w-56 justify-between border-0`}>
          <span>{day === today ? `${t('today')} · ${dayLabel(day)}` : dayLabel(day)}</span>
          <CalendarIcon className="text-muted-foreground size-4" />
        </DateRangePickerTrigger>
        <DateRangePickerContent>
          <DateRangePickerCalendar className="w-full rounded-none border-0 bg-transparent">
            <DateRangePickerHeader />
            <DateRangePickerGrid />
          </DateRangePickerCalendar>
        </DateRangePickerContent>
      </DateRangePicker>

      {/* The beui select: the list grows out of the pill (the same picker as the
          phone's country and the language). */}
      <Select value={currency} onValueChange={(value) => onCurrencyChange(value as CurrencyCode)} className="w-32 shrink-0">
        <SelectTrigger className="bg-card h-11 rounded-xl px-4 text-[15px] font-medium">
          <span className="sr-only">{t('showIn')}: </span>
          <span className="flex items-center gap-2.5">
            <Flag code={currencyFlag(currency)} />
            {currency}
          </span>
        </SelectTrigger>
        <SelectContent>
          {currencies.map((code) => (
            <SelectItem key={code} value={code} className="gap-2.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <Flag code={currencyFlag(code)} />
                <span className="font-medium">{code}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
