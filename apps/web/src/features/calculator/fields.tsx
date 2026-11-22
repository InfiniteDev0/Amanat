'use client';

import { Popover } from '@base-ui/react/popover';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, StarIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { createContext, Fragment, type ReactNode, useContext, useState } from 'react';

import { CalendarMarkGlyph } from '@/components/glyphs';
import { cn } from '@/lib/utils';

// The calculator's form pieces, as Barista's: a labelled field, a filled
// dropdown of our own with a search once it's long, the month picker, the
// small square tick box, and words marked where a search found them.

/** A filled box, no outline, light or dark. */
export const inputClass =
  'w-full rounded-xl border-0 bg-muted px-3.5 text-foreground min-h-[2.75rem] py-2.5 text-[1rem] sm:text-[0.9375rem] outline-none transition-shadow duration-200 placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30';

/** A label over its box: a red * when it must be filled, "optional" when it needn't. */
export function Field({
  label,
  htmlFor,
  optional,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  required?: boolean;
  /** What's wrong, under the box (red); or else a hint (grey). */
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTranslations('calculator');
  return (
    <div>
      <label htmlFor={htmlFor} className="text-foreground mb-2 flex items-baseline gap-2 text-[0.8125rem] font-medium">
        <span>
          {label}
          {required ? (
            <span aria-hidden className="ms-0.5 text-red-500">
              *
            </span>
          ) : null}
        </span>
        {optional ? <span className="text-muted-foreground font-normal">{t('optional')}</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-[0.8125rem] text-red-600 dark:text-red-400">{error}</p> : hint ? <p className="text-muted-foreground mt-1.5 text-[0.75rem]">{hint}</p> : null}
    </div>
  );
}

export interface PickOption {
  value: string;
  label: string;
  /** A second, quieter line. */
  detail?: string;
  /** A small tag beside the name: the main shop's ★ Main. */
  badge?: string;
  /** A line under it, setting it apart from the rest ("Any account" above the accounts). */
  separatorAfter?: boolean;
}

/** A filled field that opens a list of our own, a search at its top once there are more than a handful, a tick on the one picked. */
export function PickSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: PickOption[];
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations('calculator');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chosen = options.find((option) => option.value === value);
  const searchable = options.length > 6;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = options.filter((option) => words.every((word) => `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(word)));
  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <Popover.Trigger
        render={
          <button
            id={id}
            type="button"
            className={cn(
              'bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring/30 flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-xl px-3.5 text-start text-[1rem] outline-none transition-colors focus-visible:ring-3 sm:text-[0.9375rem]',
              className,
            )}
          />
        }
      >
        <span className={cn('min-w-0 flex-1 truncate', !chosen && 'text-muted-foreground')}>{chosen ? chosen.label : placeholder}</span>
        <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-[150]">
          <Popover.Popup className="bg-popover text-popover-foreground ring-foreground/10 w-(--anchor-width) min-w-60 rounded-lg p-1.5 shadow-lg outline-none ring-1 dark:bg-black dark:shadow-none">
            {searchable ? (
              <div className="relative mb-1">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (shown[0]) pick(shown[0].value);
                  }}
                  placeholder={t('search')}
                  aria-label={t('search')}
                  className="bg-muted placeholder:text-muted-foreground h-9 w-full rounded-md ps-8 pe-3 text-sm outline-none"
                />
              </div>
            ) : null}
            <div className="scrollbar-pill max-h-64 overflow-y-auto">
              {shown.map((option) => (
                <Fragment key={option.value}>
                  <button type="button" onClick={() => pick(option.value)} className="hover:bg-muted relative flex w-full items-center gap-2.5 rounded-md py-2 ps-2.5 pe-8 text-start">
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{option.label}</span>
                        {option.badge ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold text-amber-500">
                            <StarIcon className="size-3 fill-current" />
                            {option.badge}
                          </span>
                        ) : null}
                      </span>
                      {option.detail ? <span className="text-muted-foreground block truncate text-xs">{option.detail}</span> : null}
                    </span>
                    {option.value === value ? <CheckIcon className="absolute end-2 top-1/2 size-4 -translate-y-1/2" /> : null}
                  </button>
                  {option.separatorAfter ? <div role="separator" className="bg-border mx-1 my-1 h-px" /> : null}
                </Fragment>
              ))}
              {shown.length === 0 ? <p className="text-muted-foreground px-2.5 py-3 text-sm">{t('nothingMatches')}</p> : null}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** "2026-09" from "2026-10" and -1. */
export function stepMonth(month: string, by: number): string {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year!, index! - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "November 2026" from "2026-11", in the app's language. */
export function useMonthLabel() {
  const locale = useLocale();
  return (month: string, style: 'long' | 'short' = 'long') => {
    const [year, index] = month.split('-').map(Number);
    return new Intl.DateTimeFormat(locale, { month: style, year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year!, index! - 1, 1)));
  };
}

/** The month the cards are for: a soft field with the month and a calendar; open, the year's twelve months, the year across the top with arrows to step it. */
export function MonthPicker({ value, earliest, latest, onChange }: { value: string; earliest: string; latest: string; onChange: (month: string) => void }) {
  const t = useTranslations('calculator');
  const locale = useLocale();
  const label = useMonthLabel();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const firstYear = Number(earliest.slice(0, 4));
  const lastYear = Number(latest.slice(0, 4));
  const monthName = (index: number) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1)));
  const step = 'text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-full outline-none transition-colors disabled:pointer-events-none disabled:opacity-30';

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setYear(Number(value.slice(0, 4)));
      }}
    >
      <Popover.Trigger
        render={
          <button
            type="button"
            className="bg-card text-foreground hover:bg-card/80 focus-visible:ring-ring/30 flex h-10 min-w-52 items-center justify-between gap-6 rounded-lg px-4 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-3"
          />
        }
      >
        {label(value)}
        <CalendarMarkGlyph className="text-muted-foreground size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <Popover.Popup className="bg-popover text-popover-foreground w-80 rounded-2xl p-4 outline-none dark:bg-black">
            <div className="flex items-center justify-center gap-6 pb-4">
              <button type="button" aria-label={t('yearBefore')} disabled={year - 1 < firstYear} onClick={() => setYear(year - 1)} className={step}>
                <ChevronLeftIcon className="size-5 rtl:rotate-180" />
              </button>
              <span className="text-lg font-bold tabular-nums">{year}</span>
              <button type="button" aria-label={t('yearAfter')} disabled={year + 1 > lastYear} onClick={() => setYear(year + 1)} className={step}>
                <ChevronRightIcon className="size-5 rtl:rotate-180" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, index) => {
                const month = `${year}-${String(index + 1).padStart(2, '0')}`;
                const outside = month > latest || month < earliest;
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={outside}
                    onClick={() => {
                      onChange(month);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-[0.9375rem] font-semibold outline-none transition-colors disabled:pointer-events-none',
                      month === value
                        ? 'bg-blue-500 text-white'
                        : outside
                          ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-600'
                          : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700',
                    )}
                  >
                    {monthName(index)}
                  </button>
                );
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** What's being searched for, so every cell can mark its part of the match. */
export const SearchContext = createContext('');

/** Text with the searched words marked inside it. */
export function Mark({ children }: { children: string }) {
  const query = useContext(SearchContext).trim();
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{children}</>;
  const escaped = words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const wanted = new Set(words.map((word) => word.toLowerCase()));
  return (
    <>
      {children.split(new RegExp(`(${escaped.join('|')})`, 'gi')).map((part, index) =>
        wanted.has(part.toLowerCase()) ? (
          <mark key={index} className="rounded-[3px] bg-amber-200/80 px-0.5 text-inherit dark:bg-amber-400/25">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** The tick box, small and square. Doesn't open the row. */
export function TickBox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (next: boolean) => void; label: string }) {
  const on = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'focus-visible:ring-ring/50 relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border outline-none transition-colors focus-visible:ring-3',
        'after:absolute after:-inset-x-3 after:-inset-y-2',
        on ? 'border-primary bg-primary text-primary-foreground' : 'border-input dark:bg-input/30',
      )}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded-full bg-current" /> : checked ? <CheckIcon className="size-3.5" /> : null}
    </button>
  );
}
