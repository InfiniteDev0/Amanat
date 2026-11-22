'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';

import { WheelPicker } from '@/components/motion/wheel-picker';
import { cn } from '@/lib/utils';

/*
 * Pick a day, as Barista's (and Milo's) date wheel: the date in words, then
 * month, day and year wheels in one rounded box, Today and the tick sound
 * switch under it. Opens in the middle of the screen; closes on Escape or a
 * click outside, with no backdrop, so what it changes stays in sight. onPick
 * runs as a wheel settles. Never past `latest` (the shop's today).
 */

const daysIn = (month: number, year: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
// The wheels' shared size.
const WHEEL = { visibleCount: 7, itemHeight: 42 };

/** The tick sound, on unless turned off; remembered in this browser. */
const SOUND_KEY = 'amanat.tick-sound';
const soundListeners = new Set<() => void>();
function soundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
function setSound(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Kept for this visit only.
  }
  soundListeners.forEach((listener) => listener());
}
function subscribeSound(listener: () => void) {
  soundListeners.add(listener);
  return () => soundListeners.delete(listener);
}

interface Parts {
  month: number;
  day: number;
  year: number;
}
/** "2026-11-22" → its parts, and back. */
const partsOf = (iso: string): Parts => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1, day: Number(iso.slice(8, 10)) });
const isoOf = ({ year, month, day }: Parts) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function DateWheel({
  open,
  onOpenChange,
  onPick,
  value,
  latest,
  firstYear,
  onToday,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day picked, "yyyy-mm-dd". */
  onPick: (date: string) => void;
  /** The day it opens on. */
  value: string;
  /** The last day it offers (today): a later pick settles back on it. */
  latest: string;
  /** The first year it offers. */
  firstYear: number;
  /** Given, a Today button on the left: back to today. */
  onToday?: () => void;
}) {
  const t = useTranslations('dateWheel');
  const locale = useLocale();
  const [picked, setPicked] = useState<Parts>(() => partsOf(value));
  const sound = useSyncExternalStore(subscribeSound, soundOn, () => true);
  // Each time it opens, it opens on its day, wherever it was left.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setPicked(partsOf(value));
  }
  const lastYear = Number(latest.slice(0, 4));
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i));
  const months = Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m, 1))));
  const days = Array.from({ length: daysIn(picked.month, picked.year) }, (_, i) => String(i + 1));
  const at = new Date(Date.UTC(picked.year, picked.month, picked.day, 12));

  // A short month pulls the day back to its last (31 January → 28 February); a day to come, back to today.
  const go = (next: Parts) => {
    const settled = { ...next, day: Math.min(next.day, daysIn(next.month, next.year)) };
    const iso = isoOf(settled);
    const kept = iso > latest ? partsOf(latest) : settled;
    setPicked(kept);
    onPick(isoOf(kept));
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Popup className="bg-popover text-popover-foreground ring-foreground/10 fixed start-1/2 top-1/2 z-[150] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 rounded-3xl px-5 py-4 shadow-xl outline-none ring-1 transition-[opacity,scale] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 rtl:translate-x-1/2">
          <Dialog.Title className="text-muted-foreground text-sm font-normal">
            {new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(at)}{' '}
            <span className="text-foreground font-medium tabular-nums">{new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(at)}</span>
          </Dialog.Title>
          <div dir="ltr" className="border-border bg-background flex items-stretch gap-1 rounded-3xl border p-2">
            <WheelPicker
              options={months}
              value={months[picked.month]}
              onValueChange={(m: string) => go({ ...picked, month: months.indexOf(m) })}
              className="w-32 border-0 bg-transparent"
              {...WHEEL}
              defaultValue={undefined}
              sound={sound}
              aria-label={t('month')}
            />
            <WheelPicker
              options={days}
              value={String(picked.day)}
              onValueChange={(d: string) => go({ ...picked, day: Number(d) })}
              className="w-14 border-0 bg-transparent"
              {...WHEEL}
              defaultValue={undefined}
              sound={sound}
              aria-label={t('day')}
            />
            <WheelPicker
              options={years}
              value={String(picked.year)}
              onValueChange={(y: string) => go({ ...picked, year: Number(y) })}
              className="w-20 border-0 bg-transparent"
              {...WHEEL}
              defaultValue={undefined}
              sound={sound}
              aria-label={t('year')}
            />
          </div>
          {/* Today on the left (back to today), the tick sound switch on the right. */}
          <div className="flex w-full items-center justify-between gap-3">
            {onToday ? (
              <button
                type="button"
                onClick={() => {
                  onToday();
                  onOpenChange(false);
                }}
                className="bg-foreground text-background h-8 rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                {t('today')}
              </button>
            ) : (
              <span />
            )}
            <button type="button" role="switch" aria-checked={sound} onClick={() => setSound(!sound)} className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors">
              {t('tickSound')}
              <span className={cn('relative h-5 w-9 rounded-full transition-colors', sound ? 'bg-foreground' : 'bg-foreground/20')}>
                <span className={cn('bg-background absolute top-0.5 size-4 rounded-full shadow transition-[inset-inline-start]', sound ? 'start-[1.125rem]' : 'start-0.5')} />
              </span>
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
