'use client';

import { addDays, businessDate, isBusinessDate } from '@sarrif/core';
import { useSearchParams } from 'next/navigation';
import { LockIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { DayPicker } from '@/components/day-picker';
import { CloseDaySheet } from '@/features/closing/close-day-sheet';
import { useClosingDay } from '@/features/closing/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * The day every shop page shows (Home, the Book…), kept in the address
 * (?day=2026-10-08) so the top bar's calendar and a page's own controls
 * agree, a reload stays on it, and moving between pages keeps it. Today has
 * no ?day. Only days that have happened.
 */
export function useShopDay() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const asked = useSearchParams().get('day');
  const today = businessDate(workspace.timeZone);
  const day = isBusinessDate(asked) && asked < today ? asked : today;

  const setDay = (next: string) => {
    const target = next >= today ? today : next;
    router.replace(target === today ? pathname : `${pathname}?day=${target}`);
  };

  return { day, today, isToday: day === today, setDay, previous: () => setDay(addDays(day, -1)), next: () => setDay(addDays(day, 1)) };
}

/** The shop day's calendar, in the top bar on every shop page, with Close day under it. */
export function ShopDayPicker() {
  const t = useTranslations('shell');
  const { workspace } = useWorkspace();
  const { day, today, setDay } = useShopDay();
  const [closing, setClosing] = useState(false);
  const closed = useClosingDay(workspace.id, day).data?.closed;
  return (
    <>
      <DayPicker
        day={day}
        today={today}
        onDayChange={setDay}
        className="h-9 min-w-0 rounded-lg text-sm"
        // Close day sits under the calendar: the day is right there.
        footer={(close) => (
          <button
            type="button"
            onClick={() => {
              close();
              setClosing(true);
            }}
            className={
              closed
                ? 'flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/12 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300'
                : 'bg-foreground text-background h-10 w-full rounded-xl text-sm font-semibold transition-opacity hover:opacity-90'
            }
          >
            {closed ? (
              <>
                <LockIcon className="size-4" aria-hidden />
                {t('closedBy', { name: closed.by.name })}
              </>
            ) : (
              t('closeDay')
            )}
          </button>
        )}
      />
      <CloseDaySheet open={closing} onOpenChange={setClosing} date={day} />
    </>
  );
}
