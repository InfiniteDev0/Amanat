'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useState } from 'react';

import {
  DateRangePicker,
  DateRangePickerCalendar,
  DateRangePickerContent,
  DateRangePickerGrid,
  DateRangePickerHeader,
  DateRangePickerTrigger,
} from '@/components/motion/date-range-picker';
import { CalendarIcon } from '@/components/icons/calendar';
import { cn } from '@/lib/utils';

export const PILL_CLASS =
  'bg-card hover:bg-card/70 aria-expanded:bg-card/70 flex h-11 items-center gap-3 rounded-xl px-4 text-[15px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** "8 October 2026", for a shop's yyyy-mm-dd day (read as a calendar date, not a moment). */
export function useDayLabel() {
  const locale = useLocale();
  const format = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [locale],
  );
  return (day: string) => format.format(new Date(`${day}T00:00:00Z`));
}

/**
 * The day a page shows, as a pill ("Today · 8 October 2026") that opens
 * beui's calendar. Used for one day: a click picks that day and closes it.
 * Only days that have happened (up to `today`).
 */
export function DayPicker({
  day,
  today,
  onDayChange,
  className,
  footer,
}: {
  day: string;
  today: string;
  onDayChange: (day: string) => void;
  className?: string;
  /** Under the calendar (the shop day puts Close day there); `close` shuts the popover. */
  footer?: (close: () => void) => ReactNode;
}) {
  const t = useTranslations('home');
  const locale = useLocale();
  const dayLabel = useDayLabel();
  const [open, setOpen] = useState(false);

  return (
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
      <DateRangePickerTrigger aria-label={t('pickDay')} className={cn(PILL_CLASS, 'h-11 min-w-56 justify-between border-0', className)}>
        <span>{day === today ? `${t('today')} · ${dayLabel(day)}` : dayLabel(day)}</span>
        <CalendarIcon className="text-muted-foreground size-4" />
      </DateRangePickerTrigger>
      <DateRangePickerContent>
        <DateRangePickerCalendar className="w-full rounded-none border-0 bg-transparent">
          <DateRangePickerHeader />
          <DateRangePickerGrid />
          {footer ? <div className="mt-2">{footer(() => setOpen(false))}</div> : null}
        </DateRangePickerCalendar>
      </DateRangePickerContent>
    </DateRangePicker>
  );
}
