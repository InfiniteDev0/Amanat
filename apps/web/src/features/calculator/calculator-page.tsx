'use client';

import { type Account, addDays, businessDate, type CurrencyCode, EXPENSE_CATEGORIES, type Money, monthStart, type Report } from '@sarrif/core';
import { useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  DownloadIcon,
  FileDownIcon,
  HistoryIcon,
  PlusIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SearchIcon,
  SheetIcon,
  Trash2Icon,
  TrendingUpIcon,
  WalletCardsIcon,
  WalletIcon,
  XIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { Select as MotionSelect, SelectContent as MotionSelectContent, SelectItem as MotionSelectItem, SelectTrigger as MotionSelectTrigger, SelectValue as MotionSelectValue } from '@/components/motion/select';
import { useAccountLabel } from '@/features/accounts/account-label';
import { useAccounts } from '@/features/accounts/queries';
import { currencySymbol, useShortMoney } from '@/features/profit/money-text';
import { useReport } from '@/features/reports/queries';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import { Field, inputClass, Mark, MonthPicker, type PickOption, PickSelect, SearchContext, stepMonth, TickBox, useMonthLabel } from './fields';
import { CalculatorGlyph, Keypad } from './keypad';
import { CalculatorLoader } from './loader';
import { type AmountMode, exportListCsv, exportListPdf, fileNameOf, KINDS, RANGES, type SearchKind, type SearchParams, type SearchRange, type SearchResult, sumMoney, useRunSearch } from './search';

// Reports, as Barista's calculator page: the month's sums as cards (Money in,
// Money out, Net profit, Expenses), each against the month before; under them
// "Do some calculation", which opens the calculation box: tabs, each a search
// through the shop's records (what, over when, narrowed to an account, a
// customer, a kind, a currency, an amount) or a calculation of your own, with
// the keypad beside it. Searches keep a history; closed tabs are kept as
// Previous editors. Everything is kept in this browser, per shop.

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Keeping it in this browser ─────────────────────────────────────────── */

function readStored<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved === null ? fallback : (JSON.parse(saved) as T);
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: kept until the page is left.
  }
}

/* ── The cards ─────────────────────────────────────────────────────────── */

type Card = {
  id: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  now: Money[];
  before: Money[];
  /** Whether going up is good news (in, profit) or bad (out, expenses). */
  upIsGood: boolean;
  /** Shown as money out: a minus in front. */
  negative?: boolean;
  tone?: 'green' | 'red';
};

/** One currency's figure of a list: the base's, or the first there is. */
function figureIn(list: Money[], currency: CurrencyCode) {
  return list.find((m) => m.currency === currency)?.amount ?? 0;
}

/**
 * A card, folded to one line (the icon and name, the amount) until the pointer
 * is on it or it has focus; then the amount large, with how it moved against
 * the month before, floating over the box below.
 */
function StatCard({ card, previousMonth, loading, base }: { card: Card; previousMonth: string; loading: boolean; base: CurrencyCode }) {
  const t = useTranslations('calculator');
  const short = useShortMoney();
  const currency = card.now.some((m) => m.currency === base) || card.before.some((m) => m.currency === base) ? base : (card.now[0]?.currency ?? base);
  const now = figureIn(card.now, currency);
  const before = figureIn(card.before, currency);
  const change = before === 0 ? null : ((now - before) / Math.abs(before)) * 100;
  const up = change !== null && change > 0;
  const good = change === null || change === 0 ? null : up === card.upIsGood;
  const [open, setOpen] = useState(false);
  const shown = card.now.filter((m) => m.amount !== 0);
  const text = shown.length ? shown.map((m) => short(card.negative ? { ...m, amount: -m.amount } : m)).join(' · ') : '0';
  const toneClass = cn(card.tone === 'green' && 'text-emerald-600 dark:text-emerald-400', card.tone === 'red' && 'text-red-600 dark:text-red-400');

  return (
    <motion.section
      layout
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${card.label}: ${text}`}
      onHoverStart={() => setOpen(true)}
      onHoverEnd={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      transition={{ layout: { duration: 0.3, ease: EASE } }}
      style={{ borderRadius: 8 }}
      className={cn('bg-card focus-visible:ring-ring/30 cursor-default overflow-hidden px-5 outline-none transition-shadow focus-visible:ring-3', open && 'ring-border shadow-xl ring-1')}
    >
      <motion.div layout="position" className="flex h-12 items-center justify-between gap-3">
        <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
          <card.Icon className="size-4 shrink-0" />
          <span className="truncate">{card.label}</span>
        </p>
        <AnimatePresence initial={false}>
          {!open &&
            (loading ? (
              <span aria-hidden className="bg-muted block h-4 w-24 animate-pulse rounded" />
            ) : (
              <motion.span
                key="amount"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                dir="ltr"
                className={cn('truncate text-sm font-semibold tabular-nums', toneClass)}
              >
                {text}
              </motion.span>
            ))}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="full" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="pb-5">
              {loading ? (
                <span aria-hidden className="bg-muted block h-8 w-40 animate-pulse rounded-md" />
              ) : (
                <p dir="ltr" className={cn('truncate text-start text-[1.75rem] font-semibold tabular-nums tracking-tight', toneClass)}>
                  {text}
                </p>
              )}
              <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-sm">
                {loading ? (
                  <span aria-hidden className="bg-muted block h-4 w-32 animate-pulse rounded" />
                ) : change === null ? (
                  t('nothingToCompare', { month: previousMonth })
                ) : (
                  <>
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 font-medium tabular-nums',
                        good === true && 'text-emerald-600 dark:text-emerald-400',
                        good === false && 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {up ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
                      {Math.abs(change).toFixed(1)}%
                    </span>
                    {t('versus', { month: previousMonth })}
                  </>
                )}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/**
 * The cards, and the line under them that folds them away, as VS Code's panel
 * edge: drag it up and they fold into the top line, the box below taking their
 * room; drag it down and they're back. A double-click (or Enter) does the same.
 */
function FoldingCards({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const t = useTranslations('calculator');
  const inner = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState(64);
  const [shown, setShown] = useState(() => readStored<string>(storageKey, 'shown') !== 'folded');
  const [drag, setDrag] = useState<number | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setNatural(el.offsetHeight);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  useEffect(() => store(storageKey, shown ? 'shown' : 'folded'), [shown, storageKey]);

  const settle = () => {
    setMoving(true);
    window.setTimeout(() => setMoving(false), 350);
  };
  const startDrag = (event: ReactPointerEvent) => {
    event.preventDefault();
    const fromY = event.clientY;
    const fromHeight = shown ? natural : 0;
    let height = fromHeight;
    const move = (e: PointerEvent) => {
      height = Math.min(natural, Math.max(0, fromHeight + e.clientY - fromY));
      setDrag(height);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setDrag(null);
      settle();
      setShown(height > natural / 2);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };
  const toggle = () => {
    settle();
    setShown((s) => !s);
  };
  const clipped = drag !== null || !shown || moving;

  return (
    <>
      <motion.div
        animate={{ height: drag ?? (shown ? natural : 0) }}
        initial={false}
        transition={drag !== null ? { duration: 0 } : { duration: 0.25, ease: EASE }}
        onAnimationComplete={() => setMoving(false)}
        className={cn('shrink-0', clipped ? 'overflow-hidden' : 'overflow-visible')}
      >
        <div ref={inner} className="pt-4">
          {children}
        </div>
      </motion.div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={shown ? t('foldCards') : t('unfoldCards')}
        tabIndex={0}
        onPointerDown={startDrag}
        onDoubleClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        className="group relative flex h-4 shrink-0 cursor-row-resize touch-none items-center outline-none"
      >
        <span className={cn('h-px w-full transition-colors duration-150', drag !== null ? 'bg-ring' : 'bg-border group-hover:bg-ring group-focus-visible:bg-ring')} />
        <span
          aria-hidden
          className={cn(
            'bg-background absolute start-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 transition-colors duration-150 rtl:translate-x-1/2',
            drag !== null ? 'text-ring' : 'text-muted-foreground group-hover:text-ring group-focus-visible:text-ring',
          )}
        >
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
          <span className="size-1 rounded-full bg-current" />
        </span>
      </div>
    </>
  );
}

/* ── Calculations ──────────────────────────────────────────────────────── */

type SheetType = 'search' | 'rough';

/** A line of your own calculation: what, how many, and what each costs. */
type RoughItem = { id: string; name: string; qty: string; cost: string };

/** A search made: what it asked for, and when. */
type HistoryEntry = { id: string; at: number; params: SearchParams; detail?: string };

/** One calculation: a tab along the box's top, and its own page in the editor. */
type Sheet = {
  id: string;
  type: SheetType;
  /** The shop it searches: the main shop to start with. */
  shopId: string;
  kind: SearchKind | null;
  range: SearchRange | null;
  from: string;
  to: string;
  accountId: string;
  customer: string;
  category: string;
  currency: string;
  amountMode: AmountMode;
  amount: string;
  amountMax: string;
  history: HistoryEntry[];
  /** Your own calculation's name (or a search's, renamed); its lines and their currency. */
  title: string;
  items: RoughItem[];
  itemCurrency: string;
};

/** An editor closed: the whole of it, as it was, and when. */
type ClosedSheet = { sheet: Sheet; at: number };

const newItem = (): RoughItem => ({ id: crypto.randomUUID(), name: '', qty: '1', cost: '' });

const newSheet = (type: SheetType, currency: string, shopId: string): Sheet => ({
  id: crypto.randomUUID(),
  type,
  shopId,
  kind: null,
  range: 'thisMonth',
  from: '',
  to: '',
  accountId: '',
  customer: '',
  category: '',
  currency: '',
  amountMode: '',
  amount: '',
  amountMax: '',
  history: [],
  title: '',
  items: type === 'rough' ? [newItem()] : [],
  itemCurrency: currency,
});

/** A saved sheet, read back: anything missing filled in. */
function readSheet(saved: unknown, currency: string, mainShop: string): Sheet | null {
  const x = saved as Partial<Sheet> | null;
  if (!x || typeof x.id !== 'string') return null;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    ...newSheet(x.type === 'rough' ? 'rough' : 'search', currency, mainShop),
    id: x.id,
    shopId: text(x.shopId) || mainShop,
    kind: KINDS.find((k) => k === x.kind) ?? null,
    range: RANGES.find((r) => r === x.range) ?? 'thisMonth',
    from: text(x.from),
    to: text(x.to),
    accountId: text(x.accountId),
    customer: text(x.customer),
    category: text(x.category),
    currency: text(x.currency),
    amountMode: (['exact', 'range', 'highest', 'lowest'] as const).find((m) => m === x.amountMode) ?? '',
    amount: text(x.amount),
    amountMax: text(x.amountMax),
    history: Array.isArray(x.history) ? x.history.filter((h) => typeof h?.id === 'string' && typeof h?.at === 'number' && Boolean(h?.params?.kind)) : [],
    title: text(x.title),
    items: Array.isArray(x.items) ? x.items.filter((i) => typeof i?.id === 'string').map((i) => ({ id: i.id, name: text(i.name), qty: text(i.qty), cost: text(i.cost) })) : [],
    itemCurrency: text(x.itemCurrency) || currency,
  };
}

/** What a search tab asks for, or null while what to calculate isn't picked. */
function sheetParams(sheet: Sheet): SearchParams | null {
  if (!sheet.kind || !sheet.range) return null;
  const { shopId, kind, range, from, to, accountId, customer, category, currency, amountMode, amount, amountMax } = sheet;
  return { shopId, kind, range, from, to, accountId, customer, category, currency, amountMode, amount, amountMax };
}

/** A new id and the time now, for a search made. */
const stamp = () => ({ id: crypto.randomUUID(), at: Date.now() });

const sameSearch = (a: SearchParams, b: SearchParams) => JSON.stringify(a) === JSON.stringify(b);

/** A figure typed in, as a number (nothing, or not a number, is 0). */
const figure = (text: string) => (Number.isFinite(Number(text)) ? Number(text) : 0);
const lineTotalOf = (item: RoughItem) => figure(item.qty) * figure(item.cost);
/** The lines worth taking away: those given, or else every one with something on it. */
const roughLines = (sheet: Sheet, lines?: RoughItem[]) => (lines ?? sheet.items).filter((item) => item.name.trim() || item.cost.trim());

/** Names, times and amounts in words, in the app's language. */
function useWords() {
  const t = useTranslations('calculator');
  const tExpenses = useTranslations('expenses');
  const locale = useLocale();
  const label = useAccountLabel();
  const shops = useMyWorkspaces().data ?? [];
  const qc = useQueryClient();

  const plain = (amount: number, currency: string) => `${amount.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currencySymbol(currency)}`;
  const dayMonth = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

  /** A tab's name: what it calculates and over when ("Money in – This week", "Money out 13 – 20 Nov"); "New" until it's picked. */
  const sheetName = (sheet: Pick<Sheet, 'type' | 'title' | 'kind' | 'range' | 'from' | 'to'>): string => {
    if (sheet.type === 'rough') return sheet.title.trim() || t('add.rough');
    if (sheet.title.trim()) return sheet.title.trim();
    if (!sheet.kind) return t('newTab');
    const kind = t(`kinds.${sheet.kind}`);
    if (sheet.range === 'custom') {
      const days =
        sheet.from && sheet.to ? `${dayMonth(sheet.from)} – ${dayMonth(sheet.to)}` : sheet.from ? t('fromDay', { day: dayMonth(sheet.from) }) : sheet.to ? t('toDay', { day: dayMonth(sheet.to) }) : '';
      return days ? `${kind} ${days}` : kind;
    }
    return sheet.range ? `${kind} – ${t(`ranges.${sheet.range}`)}` : kind;
  };
  const searchName = (params: SearchParams) => sheetName({ type: 'search', title: '', ...params });

  /** What narrowed a search, in words ("$ Cash · Abdi · From 1,000 $"), or "All". */
  const describe = (params: SearchParams): string => {
    const account = params.accountId ? qc.getQueryData<Account[]>(queryKeys.accounts(params.shopId))?.find((a) => a.id === params.accountId) : undefined;
    const shop = shops.length > 1 ? shops.find((m) => m.workspace.id === params.shopId)?.workspace.name : undefined;
    const unit = params.currency || '';
    const amount =
      params.amountMode === 'exact' && params.amount
        ? plain(figure(params.amount), unit)
        : params.amountMode === 'range' && (params.amount || params.amountMax)
          ? params.amount && params.amountMax
            ? `${plain(figure(params.amount), unit)} – ${plain(figure(params.amountMax), unit)}`
            : params.amount
              ? t('fromAmount', { amount: plain(figure(params.amount), unit) })
              : t('upTo', { amount: plain(figure(params.amountMax), unit) })
          : params.amountMode === 'highest'
            ? t('amount.highest')
            : params.amountMode === 'lowest'
              ? t('amount.lowest')
              : '';
    const parts = [
      shop ?? '',
      account ? label(account) : '',
      params.customer.trim(),
      params.category ? tExpenses(`categories.${params.category as 'rent'}`) : '',
      params.currency ? currencySymbol(params.currency) : '',
      amount.trim(),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : t('all');
  };

  /** When: "Today, 14:32", or "18 Nov, 09:05". */
  const madeAt = (at: number) => {
    const when = new Date(at);
    const time = when.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return new Date().toDateString() === when.toDateString() ? t('todayAt', { time }) : `${when.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${time}`;
  };

  return { sheetName, searchName, describe, madeAt, plain };
}

/**
 * Add, as Barista's: a solid select that opens its two choices, each with its
 * colour square. White in dark mode, black in light; never the theme colour.
 */
function AddMenu({ label, onPick, className }: { label: string; onPick: (type: SheetType) => void; className?: string }) {
  const t = useTranslations('calculator');
  const options: { value: SheetType; swatch: string }[] = [
    { value: 'search', swatch: '#3b82f6' },
    { value: 'rough', swatch: '#14b8a6' },
  ];
  return (
    <MotionSelect value="" onValueChange={(pick: string) => onPick(pick as SheetType)} className={cn('w-56', className)}>
      <MotionSelectTrigger className="bg-foreground! text-background! border-foreground! [&_svg]:text-background/70! h-10 font-semibold">
        <MotionSelectValue placeholder={label} className="text-background!" />
      </MotionSelectTrigger>
      <MotionSelectContent className="bg-foreground! border-foreground!">
        {options.map(({ value, swatch }) => (
          <MotionSelectItem
            key={value}
            value={value}
            className="text-background! hover:bg-background/10! focus-visible:bg-background/10! justify-start gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap"
          >
            <span aria-hidden className="size-3.5 shrink-0 rounded-[4px]" style={{ backgroundColor: swatch }} />
            {t(`add.${value}`)}
          </MotionSelectItem>
        ))}
      </MotionSelectContent>
    </MotionSelect>
  );
}

/**
 * A row of a list of things done before: a search in an editor's History, an
 * editor on the main screen's Previous editors. Its name and, at the end,
 * when; under the pointer the time gives way to Download, Open and Delete.
 */
function PastRow({
  icon,
  name,
  detail,
  at,
  onOpen,
  onDelete,
  onDownload,
}: {
  icon: ReactNode;
  name: string;
  detail?: string;
  at: number;
  onOpen: () => void;
  onDelete: () => void;
  onDownload?: () => void;
}) {
  const t = useTranslations('calculator');
  const { madeAt } = useWords();
  return (
    <li className="group bg-muted/45 hover:bg-muted focus-within:bg-muted flex min-h-11 items-center gap-3 rounded-lg px-3 transition-colors dark:bg-white/[0.035] dark:hover:bg-white/[0.07] dark:focus-within:bg-white/[0.07]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-start outline-none">
        <span className="text-muted-foreground flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">{icon}</span>
        <span className="text-foreground shrink-0 truncate text-sm font-medium">{name}</span>
        {detail ? <span className="text-muted-foreground min-w-0 truncate text-xs">{detail}</span> : null}
      </button>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums group-focus-within:hidden group-hover:hidden [@media(hover:none)]:hidden">{madeAt(at)}</span>
      <span className="hidden shrink-0 items-center gap-1 group-focus-within:flex group-hover:flex [@media(hover:none)]:flex">
        {onDownload ? (
          <button
            type="button"
            aria-label={t('downloadName', { name })}
            title={t('downloadPdf')}
            onClick={onDownload}
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/[0.08]"
          >
            <DownloadIcon className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          className="bg-background text-foreground ring-foreground/10 hover:bg-background/70 rounded-md px-3 py-1 text-xs font-semibold shadow-xs ring-1 transition-colors"
        >
          {t('open')}
        </button>
        <button
          type="button"
          aria-label={t('deleteName', { name })}
          onClick={onDelete}
          className="text-muted-foreground hover:bg-muted rounded-md p-1.5 transition-colors hover:text-red-600 dark:hover:bg-white/[0.08] dark:hover:text-red-400"
        >
          <Trash2Icon className="size-4" />
        </button>
      </span>
    </li>
  );
}

/** Where the main screen's line down the middle was left. */
const SPLIT_KEY = 'amanat.calculator.split';

/**
 * With no editor open: the illustration and the button that starts one; and
 * beside them, once there are any, the editors closed before (Previous
 * editors). Between them a line that drags sideways, as VS Code's.
 */
function StartCalculation({
  onStart,
  closed,
  onReopen,
  onForget,
  onDownload,
}: {
  onStart: (type: SheetType) => void;
  closed: ClosedSheet[];
  onReopen: (entry: ClosedSheet) => void;
  onForget: (entry: ClosedSheet) => void;
  onDownload: (sheet: Sheet) => void;
}) {
  const t = useTranslations('calculator');
  const { sheetName } = useWords();
  const box = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(() => {
    const saved = Number(readStored(SPLIT_KEY, 50));
    return saved >= 25 && saved <= 75 ? saved : 50;
  });
  const [dragging, setDragging] = useState(false);
  useEffect(() => store(SPLIT_KEY, split), [split]);
  const rtl = useLocale() === 'ar';

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

  return (
    <div ref={box} style={{ '--split': `${split}%` } as CSSProperties} className="scrollbar-pill flex min-h-64 flex-1 flex-col overflow-x-hidden overflow-y-auto lg:flex-row lg:items-stretch">
      <div className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-5 py-6 text-center', closed.length > 0 && 'lg:w-(--split) lg:flex-none')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/tweet-something.svg" alt="" className="size-48" />
        <AddMenu label={t('doSome')} onPick={onStart} />
      </div>
      {closed.length > 0 ? (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('resize')}
            aria-valuenow={Math.round(split)}
            tabIndex={0}
            onPointerDown={startDrag}
            onDoubleClick={() => setSplit(50)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') setSplit((s) => Math.max(25, s - 2));
              if (event.key === 'ArrowRight') setSplit((s) => Math.min(75, s + 2));
            }}
            className="group relative -mx-2 hidden w-4 shrink-0 cursor-col-resize touch-none justify-center outline-none lg:flex"
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
          <section className="border-border flex min-w-0 flex-1 flex-col border-t py-6 lg:border-t-0 lg:ps-8">
            <p className="text-muted-foreground mb-2 text-xs font-medium">{t('previousEditors')}</p>
            <ul className="flex flex-col gap-1.5">
              {closed.map((entry) => (
                <PastRow
                  key={entry.sheet.id}
                  icon={entry.sheet.type === 'rough' ? <CalculatorGlyph /> : <SearchIcon />}
                  name={sheetName(entry.sheet)}
                  at={entry.at}
                  onOpen={() => onReopen(entry)}
                  onDelete={() => onForget(entry)}
                  onDownload={() => onDownload(entry.sheet)}
                />
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** An amount box: figures lined up, no up/down arrows to nudge them by accident. */
const AMOUNT_BOX = 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/**
 * A search's fields, along the top of its page: what it calculates (which
 * names the tab), the range, then what to narrow it to: an account, a
 * customer, an expense kind (money out, expenses), a currency, an amount. All
 * but the first two can be left empty.
 */
function SheetFields({ sheet, onChange, action }: { sheet: Sheet; onChange: (patch: Partial<Sheet>) => void; action?: ReactNode }) {
  const t = useTranslations('calculator');
  const tExpenses = useTranslations('expenses');
  const label = useAccountLabel();
  const { workspace: here } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const workspace = shops.find((m) => m.workspace.id === sheet.shopId)?.workspace ?? here;
  const accounts = useAccounts(workspace.id).data ?? [];
  const narrows = sheet.kind !== null;
  const byCategory = sheet.kind === 'out' || sheet.kind === 'expenses';
  const unit = sheet.currency ? ` (${currencySymbol(sheet.currency)})` : '';
  const amountBox = (key: 'amount' | 'amountMax', fieldLabel: string, placeholder: string) => (
    <Field label={fieldLabel} htmlFor={`${key}-${sheet.id}`}>
      <input
        id={`${key}-${sheet.id}`}
        type="number"
        inputMode="decimal"
        min={0}
        placeholder={placeholder}
        value={sheet[key]}
        // Never below zero: a minus is left out as it's typed.
        onChange={(event) => onChange({ [key]: event.target.value.replace('-', '') })}
        className={cn(inputClass, AMOUNT_BOX)}
      />
    </Field>
  );
  const amountModes: { id: AmountMode; key: 'any' | 'exact' | 'range' | 'highest' | 'lowest' }[] = [
    { id: '', key: 'any' },
    { id: 'exact', key: 'exact' },
    { id: 'range', key: 'range' },
    { id: 'highest', key: 'highest' },
    { id: 'lowest', key: 'lowest' },
  ];

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
      <Field label={t('fields.shop')} htmlFor={`shop-${sheet.id}`} required>
        <PickSelect
          id={`shop-${sheet.id}`}
          value={workspace.id}
          // Another shop's accounts and currencies aren't this one's: those narrowings start again.
          onChange={(shopId) => onChange({ shopId, accountId: '', currency: '' })}
          placeholder={t('fields.shop')}
          options={shops.map(({ workspace: shop }) => ({ value: shop.id, label: shop.name, badge: shop.isMain ? t('fields.main') : undefined, detail: shop.location || undefined }))}
        />
      </Field>
      <Field label={t('fields.calculate')} htmlFor={`kind-${sheet.id}`} required>
        <PickSelect
          id={`kind-${sheet.id}`}
          value={sheet.kind ?? ''}
          onChange={(value) => onChange({ kind: value as SearchKind, category: '' })}
          placeholder={t('fields.whatToCalculate')}
          options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`), detail: t(`kindNotes.${kind}`) }))}
        />
      </Field>
      <Field label={t('fields.range')} htmlFor={`range-${sheet.id}`} required>
        <PickSelect
          id={`range-${sheet.id}`}
          value={sheet.range ?? ''}
          onChange={(value) => onChange({ range: value as SearchRange })}
          placeholder={t('fields.pickRange')}
          options={RANGES.map((range) => ({ value: range, label: t(`ranges.${range}`) }))}
        />
      </Field>
      {narrows ? (
        <>
          <Field label={t('fields.account')} htmlFor={`account-${sheet.id}`} optional>
            <PickSelect
              id={`account-${sheet.id}`}
              value={sheet.accountId}
              onChange={(accountId) => onChange({ accountId })}
              placeholder={t('fields.anyAccount')}
              options={[{ value: '', label: t('fields.anyAccount'), separatorAfter: true }, ...accounts.map((a): PickOption => ({ value: a.id, label: label(a), detail: a.currency }))]}
            />
          </Field>
          <Field label={t('fields.customer')} htmlFor={`customer-${sheet.id}`} optional>
            <input
              id={`customer-${sheet.id}`}
              value={sheet.customer}
              onChange={(event) => onChange({ customer: event.target.value })}
              placeholder={t('fields.customerPlaceholder')}
              className={inputClass}
            />
          </Field>
          {byCategory ? (
            <Field label={t('fields.category')} htmlFor={`category-${sheet.id}`} optional>
              <PickSelect
                id={`category-${sheet.id}`}
                value={sheet.category}
                onChange={(category) => onChange({ category })}
                placeholder={t('fields.anyCategory')}
                options={[{ value: '', label: t('fields.anyCategory'), separatorAfter: true }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: tExpenses(`categories.${c}`) }))]}
              />
            </Field>
          ) : null}
          <Field label={t('fields.currency')} htmlFor={`currency-${sheet.id}`} optional>
            <PickSelect
              id={`currency-${sheet.id}`}
              value={sheet.currency}
              onChange={(currency) => onChange({ currency })}
              placeholder={t('fields.anyCurrency')}
              options={[{ value: '', label: t('fields.anyCurrency'), separatorAfter: true }, ...workspace.currencies.map((c) => ({ value: c, label: `${currencySymbol(c)} · ${c}` }))]}
            />
          </Field>
          <Field label={t('fields.amount')} htmlFor={`amount-mode-${sheet.id}`} optional>
            <PickSelect
              id={`amount-mode-${sheet.id}`}
              value={sheet.amountMode}
              onChange={(value) => onChange({ amountMode: value as AmountMode })}
              placeholder={t('amount.any')}
              options={amountModes.map((m) => ({ value: m.id, label: t(`amount.${m.key}`), detail: m.key !== 'any' ? t(`amountNotes.${m.key}`) : undefined, separatorAfter: m.id === '' }))}
            />
          </Field>
          {sheet.amountMode === 'exact' ? amountBox('amount', `${t('amount.exact')}${unit}`, t('fields.example')) : null}
          {sheet.amountMode === 'range' ? (
            <>
              {amountBox('amount', `${t('fields.from')}${unit}`, t('amount.lowest'))}
              {amountBox('amountMax', `${t('fields.to')}${unit}`, t('amount.highest'))}
            </>
          ) : null}
        </>
      ) : null}
      {sheet.range === 'custom' ? (
        <>
          <Field label={t('fields.from')} htmlFor={`from-${sheet.id}`} required>
            <input
              id={`from-${sheet.id}`}
              type="date"
              value={sheet.from}
              max={sheet.to || undefined}
              onChange={(event) => onChange({ from: event.target.value })}
              className={cn(inputClass, 'dark:[color-scheme:dark]')}
            />
          </Field>
          <Field label={t('fields.to')} htmlFor={`to-${sheet.id}`} required>
            <input
              id={`to-${sheet.id}`}
              type="date"
              value={sheet.to}
              min={sheet.from || undefined}
              onChange={(event) => onChange({ to: event.target.value })}
              className={cn(inputClass, 'dark:[color-scheme:dark]')}
            />
          </Field>
        </>
      ) : null}
      {/* At the end of the row after the boxes, the same (unseen) label room above it as theirs. */}
      {action ? (
        <div className="flex flex-col items-end sm:col-start-2 xl:col-start-4">
          <span aria-hidden className="invisible mb-2 text-[0.8125rem] font-medium">
            {t('fields.search')}
          </span>
          <div className="flex flex-1 [&>*]:h-full">{action}</div>
        </div>
      ) : null}
    </div>
  );
}

/** A grey block with a sheen across it: the searching rows. */
function Sheen({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-muted relative block overflow-hidden rounded-md dark:bg-white/[0.06]',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer-sweep_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/55 after:to-transparent dark:after:via-white/[0.07]',
        className,
      )}
    />
  );
}

/** What they add up to, each currency: "+1,200 $ · −34,000 KSh". */
function useTotalText() {
  const short = useShortMoney();
  return (money: Money[]) => (money.length ? money.map((m) => short(m, true)).join(' · ') : '0');
}

/**
 * A search's results. Fixed along the top: how many and what they add up to,
 * a search within them, PDF and CSV, and Go back to the form. Under it the
 * list, scrolling, striped; a tick box shows on a row under the pointer (and on
 * them all once one is ticked), and with any ticked, PDF and CSV take only those.
 */
function ResultsView({ params, result, onBack }: { params: SearchParams; result: SearchResult; onBack: () => void }) {
  const t = useTranslations('calculator');
  const { workspace } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const shopNameOf = (id: string) => shops.find((m) => m.workspace.id === id)?.workspace.name ?? workspace.name;
  const { searchName } = useWords();
  const totalText = useTotalText();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = result.rows.map((row, index) => ({ row, index })).filter(({ row }) => words.every((word) => row.join(' ').toLowerCase().includes(word)));
  const picking = ticked.size > 0;
  const allTicked = shown.length > 0 && shown.every(({ index }) => ticked.has(index));
  const chosen = picking ? shown.filter(({ index }) => ticked.has(index)) : shown;
  const totalOf = (rows: { index: number }[]) => sumMoney(rows.flatMap(({ index }) => (result.values[index] ? [result.values[index]] : [])));
  const toggle = (index: number) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const name = searchName(params);
  const fileName = fileNameOf(name, 'search');
  const downloadPdf = () =>
    void exportListPdf({
      shop: shopNameOf(params.shopId),
      title: name,
      scope: result.span,
      summary: `${t('resultsCount', { count: chosen.length })}   |   ${result.totalLabel} ${totalText(totalOf(chosen))}`,
      fileName,
      columns: result.columns,
      rows: chosen.map(({ row }) => row),
      total: { label: result.totalLabel, value: totalText(totalOf(chosen)) },
    }).catch(() => gooeyToast.error(t('couldNotPdf')));
  const downloadCsv = () =>
    exportListCsv(
      fileName,
      result.columns.map((c) => c.label),
      [...chosen.map(({ row }) => row), result.columns.map((_, i) => (i === 0 ? result.totalLabel : i === result.columns.length - 1 ? totalText(totalOf(chosen)) : ''))],
    );
  const quiet =
    'bg-muted/70 text-foreground hover:bg-muted inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-colors dark:bg-white/[0.06] dark:hover:bg-white/[0.1]';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-3">
        <div className="me-auto min-w-0">
          <p className="text-foreground text-[15px] font-semibold">
            {picking ? (
              <>
                {t('selected', { count: ticked.size })}{' '}
                <button type="button" onClick={() => setTicked(new Set())} className="text-muted-foreground hover:text-foreground ms-1 text-xs font-medium underline-offset-2 hover:underline">
                  {t('clear')}
                </button>
              </>
            ) : (
              <>
                {t('results')} <span className="text-muted-foreground tabular-nums">({shown.length})</span>
              </>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            {result.span} · {result.totalLabel}{' '}
            <span dir="ltr" className="text-foreground font-medium tabular-nums">
              {totalText(totalOf(chosen))}
            </span>
          </p>
        </div>
        {/* A search within the results: an icon at first, opening into a long box. */}
        <div className={cn('relative transition-[width] duration-300 ease-out', searching ? 'w-full sm:w-80 lg:w-96' : 'w-11')}>
          {searching ? (
            <>
              <SearchIcon className="text-muted-foreground pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2" />
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onBlur={() => {
                  if (!query.trim()) setSearching(false);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return;
                  setQuery('');
                  setSearching(false);
                }}
                placeholder={t('searchResults')}
                autoComplete="off"
                spellCheck={false}
                aria-label={t('searchResults')}
                className={cn(inputClass, 'ps-10 [&::-webkit-search-cancel-button]:hidden')}
              />
            </>
          ) : (
            <button type="button" aria-label={t('searchResults')} onClick={() => setSearching(true)} className={cn(quiet, 'w-11 justify-center px-0')}>
              <SearchIcon className="size-4" />
            </button>
          )}
        </div>
        <button type="button" onClick={downloadPdf} disabled={!chosen.length} className={cn(quiet, 'disabled:opacity-50')}>
          <FileDownIcon className="size-4" />
          {t('pdf')}
          {picking ? ` (${chosen.length})` : ''}
        </button>
        <button type="button" onClick={downloadCsv} disabled={!chosen.length} className={cn(quiet, 'disabled:opacity-50')}>
          <SheetIcon className="size-4" />
          {t('csv')}
          {picking ? ` (${chosen.length})` : ''}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="bg-foreground text-background inline-flex min-h-[2.75rem] items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <ArrowLeftIcon className="size-4 rtl:rotate-180" />
          {t('goBack')}
        </button>
      </div>

      <div className="scrollbar-pill min-h-0 flex-1 overflow-auto">
        {shown.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">{t('noMatch', { query: query.trim() })}</p>
        ) : (
          <SearchContext.Provider value={query}>
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="bg-card border-border sticky top-0 z-[1] w-10 border-b ps-4">
                    <TickBox
                      checked={allTicked}
                      indeterminate={picking && !allTicked}
                      onChange={() => setTicked(allTicked ? new Set() : new Set(shown.map(({ index }) => index)))}
                      label={allTicked ? t('clearSelection') : t('selectAll')}
                    />
                  </th>
                  {result.columns.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className={cn(
                        'bg-card text-muted-foreground border-border sticky top-0 z-[1] whitespace-nowrap border-b px-4 py-2.5 text-xs font-medium',
                        column.align === 'end' ? 'text-end' : 'text-start',
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ row, index }, n) => {
                  const on = ticked.has(index);
                  return (
                    <tr
                      key={index}
                      onClick={() => toggle(index)}
                      className={cn(
                        'group cursor-pointer transition-colors',
                        on ? 'bg-ring/10' : n % 2 === 0 ? 'bg-muted/40 dark:bg-white/[0.025]' : '',
                        !on && 'hover:bg-muted/70 dark:hover:bg-white/[0.05]',
                      )}
                    >
                      <td className="w-10 ps-4">
                        <span className={cn('flex transition-opacity', on || picking ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                          <TickBox checked={on} onChange={() => toggle(index)} label={t('selectRow', { name: row[1] ?? '' })} />
                        </span>
                      </td>
                      {row.map((cell, c) => {
                        const end = result.columns[c]?.align === 'end';
                        return (
                          <td
                            key={c}
                            dir={end ? 'ltr' : undefined}
                            className={cn('whitespace-nowrap px-4 py-3 tabular-nums', end ? 'text-foreground text-end font-medium' : c === 1 ? 'text-foreground' : 'text-muted-foreground')}
                          >
                            <Mark>{cell}</Mark>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SearchContext.Provider>
        )}
      </div>
    </div>
  );
}

/**
 * Your own calculation: a rough sum kept for later (this week's expenses, a
 * trip, stock). Its name at the top; a line per item (what, how many, what
 * each costs, the line's total); + Add item for another (Enter on a line's
 * cost does the same); and the grand total at the foot.
 */
function RoughEditor({ sheet, onChange, onPdf }: { sheet: Sheet; onChange: (patch: Partial<Sheet>) => void; onPdf: (sheet: Sheet, lines?: RoughItem[]) => void }) {
  const t = useTranslations('calculator');
  const { workspace } = useWorkspace();
  const { plain } = useWords();
  const items = sheet.items;
  const currency = sheet.itemCurrency || workspace.baseCurrency;
  const money = (amount: number) => plain(amount, currency);
  const setItem = (id: string, patch: Partial<RoughItem>) => onChange({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const addItem = () => onChange({ items: [...items, newItem()] });
  const list = useRef<HTMLDivElement>(null);
  const count = useRef(items.length);
  useEffect(() => {
    if (items.length > count.current) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' });
    count.current = items.length;
  }, [items.length]);
  const total = items.reduce((sum, item) => sum + lineTotalOf(item), 0);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const tickable = items.length > 1;
  const picking = tickable && ticked.size > 0;
  const allTicked = items.length > 0 && items.every((item) => ticked.has(item.id));
  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosenLines = picking ? items.filter((item) => ticked.has(item.id)) : undefined;
  const filled = roughLines(sheet, chosenLines);
  const downloadCsv = () => {
    const lines = roughLines(sheet, chosenLines);
    exportListCsv(
      fileNameOf(sheet.title, 'own-calculation'),
      [t('rough.item'), t('rough.qty'), t('rough.costIn', { currency }), t('rough.totalIn', { currency })],
      [...lines.map((item) => [item.name.trim(), item.qty, figure(item.cost), lineTotalOf(item)]), [t('total'), '', '', lines.reduce((sum, item) => sum + lineTotalOf(item), 0)]],
    );
  };
  const quiet =
    'bg-muted/70 text-foreground hover:bg-muted inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]';
  const box = 'bg-muted text-foreground placeholder:text-muted-foreground/70 focus-visible:ring-ring/30 h-10 w-full rounded-lg px-3 text-sm outline-none focus-visible:ring-3';
  const figures = 'tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
  const columns = cn('grid items-center gap-2', tickable ? 'grid-cols-[1.25rem_minmax(0,1fr)_4.5rem_8.5rem_8.5rem_2.25rem]' : 'grid-cols-[minmax(0,1fr)_4.5rem_8.5rem_8.5rem_2.25rem]');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={sheet.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={t('rough.namePlaceholder')}
            aria-label={t('rough.name')}
            className="placeholder:text-muted-foreground/60 min-w-0 flex-1 bg-transparent text-xl font-semibold tracking-tight outline-none"
          />
          {/* The lines' currency. */}
          <div role="radiogroup" aria-label={t('fields.currency')} className="bg-muted/70 flex gap-0.5 rounded-lg p-0.5 dark:bg-white/[0.06]">
            {workspace.currencies.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => onChange({ itemCurrency: c })}
                className={cn(
                  'h-8 rounded-md px-2.5 text-sm font-medium transition-colors',
                  currency === c ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {currencySymbol(c)}
              </button>
            ))}
          </div>
          {picking ? (
            <span className="text-muted-foreground shrink-0 text-sm">
              {t('selected', { count: ticked.size })}{' '}
              <button type="button" onClick={() => setTicked(new Set())} className="hover:text-foreground ms-1 text-xs font-medium underline-offset-2 hover:underline">
                {t('clear')}
              </button>
            </span>
          ) : null}
          <button type="button" onClick={() => onPdf(sheet, chosenLines)} disabled={!filled.length} className={quiet}>
            <FileDownIcon className="size-4" />
            {t('pdf')}
            {picking ? ` (${filled.length})` : ''}
          </button>
          <button type="button" onClick={downloadCsv} disabled={!filled.length} className={quiet}>
            <SheetIcon className="size-4" />
            {t('csv')}
            {picking ? ` (${filled.length})` : ''}
          </button>
        </div>
        <div className={cn(columns, 'text-muted-foreground mb-1.5 text-xs font-medium')}>
          {tickable ? (
            <TickBox
              checked={allTicked}
              indeterminate={picking && !allTicked}
              onChange={() => setTicked(allTicked ? new Set() : new Set(items.map((item) => item.id)))}
              label={allTicked ? t('clearSelection') : t('rough.selectEvery')}
            />
          ) : null}
          <span>{t('rough.item')}</span>
          <span>{t('rough.qty')}</span>
          <span>{t('rough.costIn', { currency: currencySymbol(currency) })}</span>
          <span className="text-end">{t('total')}</span>
          <span />
        </div>
      </div>
      <div ref={list} className="scrollbar-pill min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="flex flex-col gap-2">
          {items.map((item, n) => (
            <div key={item.id} className={cn(columns, 'group')}>
              {tickable ? (
                <span className={cn('flex transition-opacity', ticked.has(item.id) || picking ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100')}>
                  <TickBox checked={ticked.has(item.id)} onChange={() => toggle(item.id)} label={t('selectRow', { name: item.name.trim() || t('rough.thisLine') })} />
                </span>
              ) : null}
              <input
                value={item.name}
                onChange={(event) => setItem(item.id, { name: event.target.value })}
                placeholder={n === 0 ? t('rough.example') : t('rough.item')}
                aria-label={t('rough.item')}
                className={box}
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={item.qty}
                onChange={(event) => setItem(item.id, { qty: event.target.value.replace('-', '') })}
                aria-label={t('rough.howMany')}
                className={cn(box, figures)}
              />
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={item.cost}
                onChange={(event) => setItem(item.id, { cost: event.target.value.replace('-', '') })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && n === items.length - 1) addItem();
                }}
                placeholder="0"
                aria-label={t('rough.costEach')}
                className={cn(box, figures)}
              />
              <span dir="ltr" className="text-foreground truncate text-end text-sm font-medium tabular-nums">
                {money(lineTotalOf(item))}
              </span>
              <button
                type="button"
                aria-label={t('rough.remove')}
                onClick={() => onChange({ items: items.filter((i) => i.id !== item.id) })}
                className="text-muted-foreground hover:bg-muted flex size-9 items-center justify-center rounded-md transition-colors hover:text-red-600 dark:hover:text-red-400"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="text-muted-foreground hover:text-foreground hover:bg-muted mt-2 inline-flex h-9 w-fit items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
        >
          <PlusIcon className="size-4" />
          {t('rough.addItem')}
        </button>
      </div>
      <div className="border-border flex shrink-0 items-baseline justify-between gap-4 border-t px-4 py-4">
        <span className="text-muted-foreground text-sm">{t('rough.totalItems', { count: items.length })}</span>
        <span dir="ltr" className="text-foreground text-2xl font-semibold tabular-nums tracking-tight">
          {money(total)}
        </span>
      </div>
    </div>
  );
}

type Phase = { view: 'form' } | { view: 'searching' } | { view: 'empty' } | { view: 'results'; params: SearchParams; result: SearchResult };

/**
 * A search's page. The fields, Search at their end, and the searches made
 * before under a History line. Search (or one from the history) shows
 * skeletons while it looks; then the results, or, with nothing found, an
 * illustration and Try again.
 */
function SheetEditor({ sheet, onChange, onSearchPdf }: { sheet: Sheet; onChange: (patch: Partial<Sheet>) => void; onSearchPdf: (name: string, params: SearchParams) => void }) {
  const t = useTranslations('calculator');
  const runSearch = useRunSearch();
  const { searchName, describe } = useWords();
  const [phase, setPhase] = useState<Phase>({ view: 'form' });
  const ready = Boolean(sheet.kind && sheet.range && (sheet.range !== 'custom' || (sheet.from && sheet.to)));

  const search = async (params: SearchParams, remember: boolean) => {
    setPhase({ view: 'searching' });
    if (remember) {
      // Newest first; the same search again moves up rather than repeating.
      const entry: HistoryEntry = { ...stamp(), params, detail: describe(params) };
      onChange({ history: [entry, ...sheet.history.filter((h) => !sameSearch(h.params, params))].slice(0, 20) });
    }
    try {
      // Long enough to see it's looking, even when the records are already here.
      const [result] = await Promise.all([runSearch(params), new Promise((r) => window.setTimeout(r, 700))]);
      setPhase(result.rows.length ? { view: 'results', params, result } : { view: 'empty' });
    } catch {
      gooeyToast.error(t('couldNotSearch'));
      setPhase({ view: 'form' });
    }
  };

  const filter = () => {
    const params = sheetParams(sheet);
    if (ready && params) void search(params, true);
  };

  const forgetSearch = (entry: HistoryEntry) => {
    const before = sheet.history;
    onChange({ history: before.filter((h) => h.id !== entry.id) });
    gooeyToast.success(t('deleted', { name: searchName(entry.params) }), {
      description: entry.detail ?? describe(entry.params),
      action: { label: t('undo'), successLabel: t('back'), onClick: () => onChange({ history: before }) },
    });
  };

  const open = (entry: HistoryEntry) => {
    onChange({ ...entry.params });
    void search(entry.params, false);
  };

  if (phase.view === 'searching') {
    return (
      <div role="status" aria-label={t('searching')} className="flex min-h-0 flex-1 flex-col">
        <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
          <Sheen className="h-6 w-36" />
          <div className="flex gap-2">
            <Sheen className="h-9 w-20" />
            <Sheen className="h-9 w-20" />
            <Sheen className="h-9 w-24" />
          </div>
        </div>
        <div className="flex flex-col">
          {Array.from({ length: 7 }, (_, n) => (
            <div key={n} className="border-border flex items-center gap-6 border-b px-4 py-3.5">
              <Sheen className="h-4 w-24" />
              <Sheen className="h-4 w-48" />
              <Sheen className="h-4 w-24 max-sm:hidden" />
              <Sheen className="ms-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase.view === 'empty') {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        {/* On a white tile: the drawing's black lines stay seen in dark mode too. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/not-found.png" alt="" className="size-44 rounded-2xl bg-white p-2" />
        <p className="text-foreground text-[15px] font-medium">{t('notFound')}</p>
        <button
          type="button"
          onClick={() => setPhase({ view: 'form' })}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <RotateCcwIcon className="size-4" />
          {t('tryAgain')}
        </button>
      </div>
    );
  }

  if (phase.view === 'results') return <ResultsView params={phase.params} result={phase.result} onBack={() => setPhase({ view: 'form' })} />;

  return (
    <div className="scrollbar-pill flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetFields
        sheet={sheet}
        onChange={onChange}
        action={
          <button
            type="button"
            onClick={filter}
            disabled={!ready}
            className={cn(
              'inline-flex min-h-[2.75rem] items-center justify-center rounded-xl px-6 text-[1rem] font-semibold transition-colors sm:text-[0.9375rem]',
              ready ? 'bg-foreground text-background hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            {t('fields.search')}
          </button>
        }
      />
      {sheet.history.length > 0 ? (
        <section className="px-4 pb-4">
          <div className="border-border mb-1 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium">{t('history')}</p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {sheet.history.map((entry) => (
              <PastRow
                key={entry.id}
                icon={<HistoryIcon />}
                name={searchName(entry.params)}
                detail={entry.detail ?? describe(entry.params)}
                at={entry.at}
                onOpen={() => open(entry)}
                onDelete={() => forgetSearch(entry)}
                onDownload={() => onSearchPdf(searchName(entry.params), entry.params)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The calculation box: the tabs along the top (one per calculation, named for
 * what it calculates, ✕ on hover, a double-click renames) and Add at the end;
 * under them the open one's page, and with the calculator open, the keypad
 * sliding in over its end.
 */
function CalculationBox({
  sheets,
  activeId,
  showCalculator,
  onSelect,
  onClose,
  onAdd,
  onChange,
  onCloseCalculator,
  onRoughPdf,
  onSearchPdf,
}: {
  sheets: Sheet[];
  activeId: string;
  showCalculator: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: (type: SheetType) => void;
  onChange: (id: string, patch: Partial<Sheet>) => void;
  onCloseCalculator: () => void;
  onRoughPdf: (sheet: Sheet, lines?: RoughItem[]) => void;
  onSearchPdf: (name: string, params: SearchParams) => void;
}) {
  const t = useTranslations('calculator');
  const { sheetName } = useWords();
  const active = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0];
  const [renaming, setRenaming] = useState<string | null>(null);
  const rename = (sheet: Sheet, name: string) => {
    setRenaming(null);
    // Emptied, or left as the name it gets from what it's of: that name, still following its fields.
    const typedName = name.trim();
    onChange(sheet.id, { title: typedName === sheetName({ ...sheet, title: '' }) ? '' : typedName });
  };
  // A tap anywhere but the keypad (or its own button) puts it away.
  const keypad = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!showCalculator) return;
    const away = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (keypad.current?.contains(target) || target?.closest('[data-calculator-toggle]')) return;
      onCloseCalculator();
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [showCalculator, onCloseCalculator]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="bg-card flex min-h-[28rem] flex-1 flex-col overflow-hidden rounded-lg"
    >
      <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <div role="tablist" aria-label={t('tabs')} className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <AnimatePresence initial={false}>
            {sheets.map((sheet) => {
              const on = sheet.id === active?.id;
              return (
                <motion.div
                  key={sheet.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    'group flex h-9 shrink-0 items-center rounded-md transition-colors',
                    on ? 'bg-muted/70 text-foreground dark:bg-white/[0.06]' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  )}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onSelect(sheet.id)}
                    onDoubleClick={() => setRenaming(sheet.id)}
                    title={t('renameHint')}
                    className="flex h-full max-w-64 items-center gap-2 ps-3 pe-1 text-sm font-semibold outline-none"
                  >
                    <span aria-hidden className="flex size-4 shrink-0 items-center justify-center opacity-70 [&>svg]:size-4">
                      {sheet.type === 'rough' ? <CalculatorGlyph /> : <SearchIcon />}
                    </span>
                    {renaming === sheet.id ? (
                      <input
                        autoFocus
                        defaultValue={sheetName(sheet)}
                        aria-label={t('nameTab')}
                        onFocus={(event) => event.currentTarget.select()}
                        onClick={(event) => event.stopPropagation()}
                        onBlur={(event) => rename(sheet, event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') setRenaming(null);
                          event.stopPropagation();
                        }}
                        className="bg-background text-foreground ring-ring/40 w-44 rounded px-1.5 py-0.5 text-sm font-semibold outline-none ring-2"
                      />
                    ) : (
                      <span className="truncate">{sheetName(sheet)}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={t('closeTab', { name: sheetName(sheet) })}
                    onClick={() => onClose(sheet.id)}
                    className={cn(
                      'hover:bg-foreground/10 me-1.5 flex size-5 items-center justify-center rounded transition-opacity',
                      on ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 group-hover:hover:opacity-100',
                    )}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        <AddMenu label={t('addButton')} onPick={onAdd} className="w-56 shrink-0" />
      </div>
      <div className="relative flex min-h-0 flex-1">
        {active ? (
          <div key={active.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
            {active.type === 'rough' ? (
              <RoughEditor sheet={active} onChange={(patch) => onChange(active.id, patch)} onPdf={onRoughPdf} />
            ) : (
              <SheetEditor sheet={active} onChange={(patch) => onChange(active.id, patch)} onSearchPdf={onSearchPdf} />
            )}
          </div>
        ) : null}
        <AnimatePresence initial={false}>
          {showCalculator ? (
            <motion.aside
              key="calculator"
              ref={keypad}
              aria-label={t('calculator')}
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="bg-card border-border absolute inset-y-0 end-0 z-10 w-80 max-w-full overflow-y-auto border-s p-4 shadow-[-12px_0_32px_-12px_rgba(0,0,0,0.35)]"
            >
              <Keypad />
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/** When the page was last open: the loader plays the first time, or after half an hour away. */
const SEEN_KEY = 'amanat.calculator.seen';
const AWAY_MS = 30 * 60 * 1000;
const recentlySeen = () => {
  const at = Number(readStored(SEEN_KEY, 0));
  return at > 0 && Date.now() - at < AWAY_MS;
};

/** The month's sums and the month before, from the same report the other pages read. */
function useMonthReports(workspaceId: string, month: string, today: string) {
  const range = (m: string) => {
    const from = `${m}-01`;
    const end = addDays(monthStart(addDays(from, 32)), -1);
    return { from, to: end > today ? today : end };
  };
  const now = range(month);
  const before = range(stepMonth(month, -1));
  const a = useReport(workspaceId, now.from, now.to);
  const b = useReport(workspaceId, before.from, before.to);
  return { now: a.data, before: b.data, loading: !a.data || !b.data, failed: a.isError || b.isError };
}

/**
 * Reports: the calculator. The month on the left of the top line (this one to
 * start with) and, while your own calculation is open, the Calculator button
 * at the right; the month's sums as cards that fold away; and under them the
 * calculation box, or the illustration with "Do some calculation".
 */
export function CalculatorPage() {
  const t = useTranslations('calculator');
  const { workspace } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];
  const mainShop = shops.find((m) => m.workspace.isMain)?.workspace.id ?? workspace.id;
  const shopName = (id: string) => shops.find((m) => m.workspace.id === id)?.workspace.name ?? workspace.name;
  const { sheetName } = useWords();
  const runSearch = useRunSearch();
  const totalText = useTotalText();
  const monthLabel = useMonthLabel();
  const { plain } = useWords();
  const today = businessDate(workspace.timeZone);
  const thisMonth = today.slice(0, 7);
  const base = workspace.baseCurrency;
  const sheetsKey = `amanat.calculator.sheets.${workspace.id}`;
  const closedKey = `amanat.calculator.closed.${workspace.id}`;

  const [ready, setReady] = useState(recentlySeen);
  useEffect(() => {
    store(SEEN_KEY, Date.now());
    const keep = window.setInterval(() => store(SEEN_KEY, Date.now()), 60_000);
    return () => {
      window.clearInterval(keep);
      store(SEEN_KEY, Date.now());
    };
  }, []);

  const [month, setMonth] = useState(thisMonth);
  const [sheets, setSheets] = useState<Sheet[]>(() => readStored<unknown[]>(sheetsKey, []).flatMap((s) => readSheet(s, base, mainShop) ?? []));
  const [activeId, setActiveId] = useState(() => sheets[0]?.id ?? '');
  useEffect(() => store(sheetsKey, sheets), [sheets, sheetsKey]);
  const [closed, setClosed] = useState<ClosedSheet[]>(() =>
    readStored<{ sheet?: unknown; at?: unknown }[]>(closedKey, []).flatMap((entry) => {
      const sheet = readSheet(entry?.sheet, base, mainShop);
      return sheet && typeof entry?.at === 'number' ? [{ sheet, at: entry.at }] : [];
    }),
  );
  useEffect(() => store(closedKey, closed), [closed, closedKey]);

  const addSheet = (type: SheetType) => {
    const sheet = newSheet(type, base, mainShop);
    setSheets((all) => [...all, sheet]);
    setActiveId(sheet.id);
  };
  const reopenSheet = (entry: ClosedSheet) => {
    setClosed((all) => all.filter((c) => c.sheet.id !== entry.sheet.id));
    setSheets((all) => [...all, entry.sheet]);
    setActiveId(entry.sheet.id);
  };
  const forgetSheet = (entry: ClosedSheet) => {
    const at = closed.findIndex((c) => c.sheet.id === entry.sheet.id);
    setClosed((all) => all.filter((c) => c.sheet.id !== entry.sheet.id));
    gooeyToast.success(t('deleted', { name: sheetName(entry.sheet) }), {
      action: {
        label: t('undo'),
        successLabel: t('back'),
        onClick: () => setClosed((all) => (all.some((c) => c.sheet.id === entry.sheet.id) ? all : [...all.slice(0, at), entry, ...all.slice(at)])),
      },
    });
  };
  const [openCalculator, setShowCalculator] = useState(false);
  const closeSheet = (id: string) => {
    const at = sheets.findIndex((sheet) => sheet.id === id);
    const rest = sheets.filter((sheet) => sheet.id !== id);
    const gone = sheets[at];
    // Kept, unless it's still blank.
    const used = gone ? (gone.type === 'rough' ? Boolean(gone.title.trim()) || gone.items.some((item) => item.name.trim() || item.cost.trim()) : Boolean(gone.kind) || gone.history.length > 0) : false;
    if (gone && used) setClosed((all) => [{ sheet: gone, at: Date.now() }, ...all].slice(0, 30));
    setSheets(rest);
    if (rest.length === 0) setShowCalculator(false);
    if (id === activeId) setActiveId(rest[Math.min(at, rest.length - 1)]?.id ?? '');
    if (gone) {
      gooeyToast.success(t('closed', { name: sheetName(gone) }), {
        description: used ? t('keptInPrevious') : undefined,
        action: {
          label: t('undo'),
          successLabel: t('back'),
          onClick: () => {
            setClosed((all) => all.filter((c) => c.sheet.id !== gone.id));
            setSheets((all) => (all.some((sheet) => sheet.id === gone.id) ? all : [...all.slice(0, at), gone, ...all.slice(at)]));
            setActiveId(gone.id);
          },
        },
      });
    }
  };
  const changeSheet = (id: string, patch: Partial<Sheet>) => setSheets((all) => all.map((sheet) => (sheet.id === id ? { ...sheet, ...patch } : sheet)));
  const activeSheet = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0];
  const ownOpen = activeSheet?.type === 'rough';
  const showCalculator = openCalculator && ownOpen;
  const closeCalculator = useCallback(() => setShowCalculator(false), []);

  /** Your own calculation as a PDF: the lines given, or all of them. */
  const roughPdf = (sheet: Sheet, lines?: RoughItem[]) => {
    const chosen = roughLines(sheet, lines);
    if (!chosen.length) return void gooeyToast.error(t('nothingToDownload'), { description: t('noLines') });
    const currency = sheet.itemCurrency || base;
    const total = chosen.reduce((sum, item) => sum + lineTotalOf(item), 0);
    void exportListPdf({
      shop: workspace.name,
      title: sheetName(sheet),
      scope: t('add.rough'),
      summary: `${t('rough.totalItems', { count: chosen.length })}   |   ${plain(total, currency)}`,
      fileName: fileNameOf(sheetName(sheet), 'own-calculation'),
      columns: [
        { label: t('rough.item'), width: 3.2 },
        { label: t('rough.qty'), width: 0.8, align: 'end' },
        { label: t('rough.costEach'), width: 1.4, align: 'end' },
        { label: t('total'), width: 1.4, align: 'end' },
      ],
      rows: chosen.map((item) => [item.name.trim() || '—', item.qty || '0', plain(figure(item.cost), currency), plain(lineTotalOf(item), currency)]),
      total: { label: t('total'), value: plain(total, currency) },
    }).catch(() => gooeyToast.error(t('couldNotPdf')));
  };
  /** A search's PDF, run afresh; nothing found says so instead. */
  const searchPdf = async (name: string, params: SearchParams) => {
    try {
      const result = await runSearch(params);
      if (!result.rows.length) return void gooeyToast.error(t('nothingToDownload'), { description: t('findsNothing') });
      await exportListPdf({
        shop: shopName(params.shopId),
        title: name,
        scope: result.span,
        summary: `${t('resultsCount', { count: result.rows.length })}   |   ${result.totalLabel} ${totalText(result.total)}`,
        fileName: fileNameOf(name, 'search'),
        columns: result.columns,
        rows: result.rows,
        total: { label: result.totalLabel, value: totalText(result.total) },
      });
    } catch {
      gooeyToast.error(t('couldNotPdf'));
    }
  };
  const downloadEditor = (sheet: Sheet) => {
    if (sheet.type === 'rough') return roughPdf(sheet);
    const params = sheetParams(sheet);
    if (!params) return void gooeyToast.error(t('nothingToDownload'), { description: t('nothingPicked') });
    void searchPdf(sheetName(sheet), params);
  };

  const { now, before, loading, failed } = useMonthReports(workspace.id, month, today);
  const pick = (report: Report | undefined, of: (r: Report) => Money[]) => (report ? of(report) : []);
  const netNow = pick(now, (r) => r.net);
  const cards: Card[] = [
    { id: 'in', label: t('cards.in'), Icon: WalletIcon, now: pick(now, (r) => r.moneyIn), before: pick(before, (r) => r.moneyIn), upIsGood: true },
    { id: 'out', label: t('cards.out'), Icon: WalletCardsIcon, now: pick(now, (r) => r.moneyOut), before: pick(before, (r) => r.moneyOut), upIsGood: false, negative: true },
    {
      id: 'net',
      label: t('cards.net'),
      Icon: TrendingUpIcon,
      now: netNow,
      before: pick(before, (r) => r.net),
      upIsGood: true,
      tone: figureIn(netNow, base) < 0 ? 'red' : 'green',
    },
    { id: 'expenses', label: t('cards.expenses'), Icon: ReceiptIcon, now: pick(now, (r) => r.expenses), before: pick(before, (r) => r.expenses), upIsGood: false, negative: true, tone: 'red' },
  ];

  return (
    <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col px-4 py-6 lg:px-6">
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div key="loading" className="flex min-h-[60vh] flex-1 flex-col items-center justify-center" exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
            <CalculatorLoader onDone={() => setReady(true)} />
          </motion.div>
        ) : (
          <motion.div key="page" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
              <MonthPicker value={month} earliest={stepMonth(thisMonth, -24)} latest={thisMonth} onChange={setMonth} />
              {ownOpen ? (
                <button
                  type="button"
                  data-calculator-toggle
                  aria-pressed={showCalculator}
                  onClick={() => setShowCalculator((open) => !open)}
                  className={cn(
                    'focus-visible:ring-ring/30 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-3',
                    showCalculator ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted',
                  )}
                >
                  <CalculatorGlyph className="size-4" />
                  {t('calculator')}
                </button>
              ) : null}
            </div>

            <FoldingCards storageKey="amanat.calculator.cards">
              {failed ? (
                <p className="bg-card text-muted-foreground rounded-lg p-5 text-sm">{t('loadFailed')}</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {cards.map((card) => (
                    // Each card keeps its folded row's place; opened, it floats over what's below.
                    <div key={card.id} className="relative z-10 h-12 focus-within:z-20 hover:z-20">
                      <div className="absolute inset-x-0 top-0">
                        <StatCard card={card} previousMonth={monthLabel(stepMonth(month, -1), 'long')} loading={loading} base={base} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FoldingCards>

            {sheets.length > 0 ? (
              <CalculationBox
                sheets={sheets}
                activeId={activeId}
                showCalculator={showCalculator}
                onCloseCalculator={closeCalculator}
                onSelect={setActiveId}
                onClose={closeSheet}
                onAdd={addSheet}
                onChange={changeSheet}
                onRoughPdf={roughPdf}
                onSearchPdf={(name, params) => void searchPdf(name, params)}
              />
            ) : (
              <StartCalculation onStart={addSheet} closed={closed} onReopen={reopenSheet} onForget={forgetSheet} onDownload={downloadEditor} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
