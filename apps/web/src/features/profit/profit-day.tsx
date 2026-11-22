'use client';

import { dealSection } from '@sarrif/core';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileDownIcon, SheetIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, type PointerEvent as ReactPointerEvent, Suspense, useEffect, useRef, useState } from 'react';

import { DateWheel } from '@/components/date-wheel';
import { Button } from '@/components/ui/button';
import { useDeals } from '@/features/deals/queries';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { gooeyToast } from 'goey-toast';

import { ExchangeDialog } from '@/features/home/exchange-dialog';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { DealsCard, useDealExport } from './deals-card';

// Profit, one day at a time, as Barista's Day plan: the day ("Sun Nov 22",
// the weekday blue when it's today; click it for the date wheel) with ‹ ›
// beside it, and across from it All | Exchange | Sallam; a line under them.
// All: Exchange on the left and Sallam on the right, a line between them that
// drags sideways (as VS Code's, a double-click puts it back in the middle);
// Exchange or Sallam: that one alone.

type View = 'all' | 'exchange' | 'sallam';
const VIEWS: View[] = ['all', 'exchange', 'sallam'];

/** Where the line down the middle was left, kept in this browser. */
const SPLIT_KEY = 'amanat.profit-split';
function readSplit(): number {
  try {
    const saved = Number(window.localStorage.getItem(SPLIT_KEY));
    return saved >= 25 && saved <= 75 ? saved : 50;
  } catch {
    return 50;
  }
}

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
  const { workspace } = useWorkspace();
  const { day, today, isToday, previous, next, setDay } = useShopDay();
  const shown = new Date(`${day}T12:00:00Z`);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [view, setView] = useState<View>('all');
  const deals = useDeals(workspace.id, isToday ? undefined : day);
  const rows = deals.data ?? [];
  const exchange = rows.filter((row) => dealSection(row.deal) === 'exchange');
  const sallam = rows.filter((row) => dealSection(row.deal) === 'sallam');

  // The line down the middle: dragged sideways, between a quarter and three quarters across.
  const box = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(() => (typeof window === 'undefined' ? 50 : readSplit()));
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    try {
      window.localStorage.setItem(SPLIT_KEY, String(split));
    } catch {
      // Private mode: not remembered.
    }
  }, [split]);
  const rtl = locale === 'ar';
  const startDrag = (event: ReactPointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    setDragging(true);
    const move = (e: PointerEvent) => {
      const share = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(75, Math.max(25, rtl ? 100 - share : share)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const [exchanging, setExchanging] = useState(false);
  const take = useDealExport();
  const viewRows = view === 'exchange' ? exchange : view === 'sallam' ? sallam : rows;
  const viewTitle = view === 'exchange' ? t('exchange') : view === 'sallam' ? t('sallam') : t('title');
  const dayName = isToday ? t('card.today') : new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(shown);
  // Each side as Barista's class schedule: its pill, search and +, then its deals.
  const column = (title: string, list: typeof rows) => {
    const isExchange = title === t('exchange');
    return (
      <DealsCard
        title={title}
        scope={dayName}
        sub={isExchange ? t('card.exchangeSub', { day: dayName }) : t('card.sallamSub', { day: dayName })}
        rows={list}
        loading={!deals.data}
        addLabel={isExchange ? t('card.addExchange') : t('card.addSallam')}
        onAdd={() => (isExchange ? setExchanging(true) : gooeyToast.info(t('card.sallamSoon')))}
        empty={isExchange ? t('card.noExchange') : t('card.noSallam')}
      />
    );
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[96rem] flex-col px-4 py-6 lg:px-6">
      {/* The day and its arrows; across from it All | Exchange | Sallam; a line under them. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:border-neutral-800">
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

        <div className="flex w-full items-center gap-2 sm:w-auto">
        {/* The day's profit to take away: what's showing (All, Exchange or Sallam), as a PDF or a CSV. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!deals.data}
            className="bg-muted text-foreground hover:bg-muted/70 flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors disabled:opacity-40 [&_svg]:size-4"
          >
            <DownloadIcon />
            {t('export.download')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-lg p-1.5">
            <DropdownMenuItem className="gap-2.5 py-2" onClick={() => void take.pdf(viewRows, viewTitle, dayName)}>
              <FileDownIcon />
              {t('export.pdf')}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2.5 py-2" onClick={() => take.csv(viewRows, viewTitle, dayName)}>
              <SheetIcon />
              {t('export.csv')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* All | Exchange | Sallam, as Barista's segment tabs: the pill slides to the one picked. */}
        <div role="tablist" aria-label={t('views.label')} className="flex w-full shrink-0 rounded-md bg-black/[0.06] p-0.5 sm:w-auto dark:bg-white/[0.08]">
          {VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn(
                'relative flex-1 rounded-[5px] px-3 py-1.5 text-sm font-medium outline-none transition-colors sm:flex-none sm:py-1 sm:text-[13px]',
                view === value ? 'text-background' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {view === value ? <motion.span layoutId="profit-view" transition={{ type: 'spring', stiffness: 245, damping: 36, mass: 1.2 }} className="bg-foreground absolute inset-0 rounded-[5px]" /> : null}
              <span className="relative">{t(`views.${value}`)}</span>
            </button>
          ))}
        </div>
        </div>
        <ExchangeDialog open={exchanging} onClose={() => setExchanging(false)} shopId={workspace.id} />
        <DateWheel open={wheelOpen} onOpenChange={setWheelOpen} value={day} latest={today} firstYear={Number(today.slice(0, 4)) - 2} onPick={setDay} onToday={() => setDay(today)} />
      </div>

      {view === 'all' ? (
        <div ref={box} style={{ '--split': `${split}%` } as CSSProperties} className="flex min-h-0 flex-1 flex-col gap-6 pt-4 lg:flex-row lg:gap-0">
          <div className="min-w-0 lg:w-(--split) lg:flex-none lg:pe-6">{column(t('exchange'), exchange)}</div>
          {/* The line down the middle, a grip in its middle; drag it sideways, double-click to centre it. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('views.resize')}
            aria-valuenow={Math.round(split)}
            tabIndex={0}
            onPointerDown={startDrag}
            onDoubleClick={() => setSplit(50)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setSplit((s) => Math.max(25, s - 2));
              if (event.key === 'ArrowRight') setSplit((s) => Math.min(75, s + 2));
            }}
            className="group relative -mx-2 hidden w-4 shrink-0 cursor-col-resize touch-none justify-center self-stretch outline-none lg:flex"
          >
            <span className={cn('h-full w-px transition-colors duration-150', dragging ? 'bg-ring' : 'bg-border group-hover:bg-ring group-focus-visible:bg-ring')} />
            <span
              aria-hidden
              className={cn(
                'bg-background absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full px-1 py-2 transition-colors duration-150',
                dragging ? 'text-ring' : 'text-muted-foreground group-hover:text-ring group-focus-visible:text-ring',
              )}
            >
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
            </span>
          </div>
          <div className="min-w-0 flex-1 lg:ps-6">{column(t('sallam'), sallam)}</div>
        </div>
      ) : (
        <div className="pt-4">{view === 'exchange' ? column(t('exchange'), exchange) : column(t('sallam'), sallam)}</div>
      )}
    </div>
  );
}
