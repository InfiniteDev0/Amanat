'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { CalendarFlexIcon } from '@/components/icons/calendar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useShopDay } from '@/features/workspaces/shop-day';
import { SidebarCalendar } from '@/features/workspaces/sidebar-calendar';
import { cn } from '@/lib/utils';

/**
 * The centre of the top bar: a calendar icon that opens the calendar; beside
 * it ‹ "Sat: 10/17/2026" › (the weekday in a pink to
 * blue gradient), stepping through the shop's days, none after today, then a
 * Today badge that's always there: filled on today, and from an older day one
 * click brings you back.
 */
export function SidebarDay() {
  const t = useTranslations('profit');
  const tHome = useTranslations('home');
  const locale = useLocale();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { day, today, isToday, previous, next, setDay } = useShopDay();
  const shown = new Date(`${day}T00:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(shown);

  return (
    <div className="flex items-center gap-3">
      {/* A small icon, like the bell, that opens the calendar under it. */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <Tooltip>
          <PopoverTrigger
            render={
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={tHome('pickDay')}
                    className="text-foreground/80 hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                }
              />
            }
          >
            <CalendarFlexIcon className="size-5" />
          </PopoverTrigger>
          <TooltipContent side="bottom">{tHome('pickDay')}</TooltipContent>
        </Tooltip>
        <PopoverContent align="start" className="w-auto p-3 shadow-none ring-0">
          <SidebarCalendar onPick={() => setCalendarOpen(false)} />
        </PopoverContent>
      </Popover>

      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={previous}
          aria-label={t('previousDay')}
          className="rounded-md border border-black/20 p-1 text-black transition-colors hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
        >
          <ChevronLeftIcon className="size-3.5 rtl:rotate-180" />
        </button>
        <h1 className="truncate text-lg font-semibold">
          <span className="bg-linear-to-r from-[#4ff6d5]  to-[#12c2e9] bg-clip-text text-transparent">{format({ weekday: 'short' })}</span>
          {': '}
          <bdi dir="ltr" className="tabular-nums text-sm">
            {format({ year: 'numeric', month: 'numeric', day: 'numeric' })}
          </bdi>
        </h1>
        <button
          type="button"
          onClick={next}
          disabled={isToday}
          aria-label={t('nextDay')}
          className="rounded-md bg-black p-1 text-white transition-opacity hover:opacity-80 disabled:opacity-10 dark:bg-white dark:text-black"
        >
          <ChevronRightIcon className="size-3.5 rtl:rotate-180" />
        </button>
        {/* Always shown after ›, so the way back to today is one click. */}
        <Badge
          variant="outline"
          render={<button type="button" onClick={() => setDay(today)} disabled={isToday} aria-current={isToday ? 'date' : undefined} />}
          className={cn(
            'rounded-sm transition-colors',
            isToday ? 'border-transparent bg-black text-white dark:bg-white dark:text-black' : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
          )}
        >
          {t('today')}
        </Badge>
      </div>
    </div>
  );
}
