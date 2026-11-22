'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';

import { DateWheel } from '@/components/date-wheel';
import { Button } from '@/components/ui/button';
import { useShopDay } from '@/features/workspaces/shop-day';

// Profit, one day at a time, as Barista's Day plan: the day ("Sun Nov 22",
// the weekday blue when it's today; click it for the date wheel) with ‹ ›
// beside it and a line under them. What goes under it comes next.

export function ProfitDay() {
  return (
    <Suspense fallback={null}>
      <Day />
    </Suspense>
  );
}

function Day() {
  const t = useTranslations('profit');
  const locale = useLocale();
  const { day, today, isToday, previous, next, setDay } = useShopDay();
  const shown = new Date(`${day}T12:00:00Z`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const [wheelOpen, setWheelOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[96rem] flex-col px-4 py-6 lg:px-6">
      {/* The day, the arrows that move it beside it, and a line under them. */}
      <div className="border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          {/* The date itself opens the wheel: pick any day. */}
          <button
            type="button"
            onClick={() => setWheelOpen(true)}
            title={t('day.pick')}
            className="hover:bg-foreground/5 focus-visible:ring-ring/30 -mx-1.5 rounded-lg px-1.5 text-start outline-none transition-colors focus-visible:ring-3"
          >
            <span className="block text-2xl font-semibold tracking-tight" aria-live="polite">
              {/* Blue marks today; any other day is all grey. */}
              <span className={isToday ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}>{new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(shown)}</span>{' '}
              <span className="text-muted-foreground">{new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(shown)}</span>
            </span>
          </button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" aria-label={t('previousDay')} onClick={previous}>
              <ChevronLeftIcon className="rtl:rotate-180" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('nextDay')} onClick={next} disabled={isToday}>
              <ChevronRightIcon className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
        <DateWheel open={wheelOpen} onOpenChange={setWheelOpen} value={day} latest={today} firstYear={Number(today.slice(0, 4)) - 2} onPick={setDay} onToday={() => setDay(today)} />
      </div>
    </div>
  );
}
