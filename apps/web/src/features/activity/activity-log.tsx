'use client';

import { addDays, type ActivityRow, businessDate, fromMinor } from '@sarrif/core';
import { useQueries } from '@tanstack/react-query';
import {
  ActivityIcon,
  ArrowLeftRightIcon,
  ArrowUpDownIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  HandCoinsIcon,
  LockIcon,
  LockOpenIcon,
  type LucideIcon,
  PencilIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  StoreIcon,
  Trash2Icon,
  TrendingUpIcon,
  UserMinusIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PickSelect } from '@/features/calculator/fields';
import { useShortMoney } from '@/features/profit/money-text';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link, useRouter } from '@/i18n/navigation';
import { directionOf } from '@/i18n/routing';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

// The activity log, as Barista's: a sheet beside the notifications', who did
// what, newest first, down a timeline. The title is a menu that narrows it to
// one kind; the search button slides a filter column open beside it (a word,
// then folding sections for the kind, who did it, the amount and a from–to
// date and time), the log staying where it is. A opens it from anywhere.

/** The newest this many, for the kind picked. */
const LIMIT = 60;
/** With no dates set: the last two weeks. */
const RECENT_DAYS = 14;
/** At most this many days at once. */
const MAX_DAYS = 92;
/** How long the sheet takes to slide away: the page changes after it has. */
const SHEET_CLOSE_MS = 300;
const EASE = [0.22, 1, 0.36, 1] as const;

const HEADER_BUTTON =
  'text-foreground hover:bg-black/5 dark:hover:bg-white/10 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-5';

/** The kinds in the title's menu. */
const VIEWS = ['all', 'exchanges', 'expenses', 'amanat', 'moves', 'day', 'people', 'deletions'] as const;
type View = (typeof VIEWS)[number];

const TONES = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-green-600 dark:text-green-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  teal: 'text-teal-600 dark:text-teal-400',
  violet: 'text-violet-600 dark:text-violet-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
  neutral: 'text-neutral-500 dark:text-neutral-400',
} as const;

/** What the line is about: a Sallam or an exchange row, an amanat held or given back, the day, someone… */
function subjectOf({ activity }: ActivityRow): string {
  const record = (activity.after ?? activity.before) as Record<string, unknown> | null;
  if (activity.recordType === 'exchange') return record && !Array.isArray(record) && record.currencyIn === record.currencyOut ? 'sallam' : 'exchange';
  if (activity.recordType === 'amanat') return record && !Array.isArray(record) && record.type === 'withdrawal' ? 'amanatBack' : 'amanat';
  return activity.recordType;
}

/** The kind of page a line opens, if any. */
type LinkTo = 'profit' | 'amanat' | 'settings' | 'shop';

interface ActionMeta {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  link?: LinkTo;
  view: Exclude<View, 'all' | 'deletions'> | null;
}

/** Each subject: its icon, colour, the menu kind it falls under and where its button goes. */
const SUBJECTS: Record<string, ActionMeta> = {
  exchange: { icon: ArrowLeftRightIcon, tone: 'green', link: 'profit', view: 'exchanges' },
  sallam: { icon: SmartphoneIcon, tone: 'blue', link: 'profit', view: 'exchanges' },
  expense: { icon: ReceiptIcon, tone: 'yellow', link: 'profit', view: 'expenses' },
  amanat: { icon: HandCoinsIcon, tone: 'amber', link: 'amanat', view: 'amanat' },
  amanatBack: { icon: HandCoinsIcon, tone: 'amber', link: 'amanat', view: 'amanat' },
  transfer: { icon: ArrowUpDownIcon, tone: 'violet', view: 'moves' },
  rates: { icon: TrendingUpIcon, tone: 'teal', link: 'settings', view: 'day' },
  day: { icon: LockIcon, tone: 'violet', link: 'profit', view: 'day' },
  invitation: { icon: UserPlusIcon, tone: 'blue', link: 'shop', view: 'people' },
  member: { icon: ShieldCheckIcon, tone: 'violet', link: 'shop', view: 'people' },
  workspace: { icon: StoreIcon, tone: 'neutral', link: 'settings', view: 'people' },
};

/** The line's icon: by what was done (a deletion is red, whatever it was), then by what it was about. */
function metaOf(row: ActivityRow): ActionMeta {
  const subject = SUBJECTS[subjectOf(row)] ?? { icon: ActivityIcon, tone: 'neutral', view: null };
  switch (row.activity.action) {
    case 'delete':
      return { ...subject, icon: Trash2Icon, tone: 'red' };
    case 'edit':
      return { ...subject, icon: PencilIcon, tone: 'blue' };
    case 'restore':
      return { ...subject, icon: RotateCcwIcon, tone: 'teal' };
    case 'reopen':
      return { ...subject, icon: LockOpenIcon };
    case 'remove_member':
      return { ...subject, icon: UserMinusIcon, tone: 'red' };
    default:
      return subject;
  }
}

function inView(row: ActivityRow, view: View): boolean {
  if (view === 'all') return true;
  if (view === 'deletions') return row.activity.action === 'delete' || row.activity.action === 'remove_member';
  return metaOf(row).view === view;
}

/** Everything the filter column narrows by. Empty strings mean "any". */
interface Filters {
  search: string;
  view: View;
  actor: string;
  minAmount: string;
  maxAmount: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
}
const NO_FILTERS: Filters = { search: '', view: 'all', actor: '', minAmount: '', maxAmount: '', fromDate: '', fromTime: '', toDate: '', toTime: '' };

/** Kinds that carry an amount. */
const hasAmount = (view: View) => ['all', 'exchanges', 'expenses', 'amanat', 'moves', 'deletions'].includes(view);

type Section = 'activity' | 'staff' | 'amount' | 'date';

/** One typed word as a pattern. A number matches only a whole number, with or without its thousands separators. */
function wordPattern(word: string): string {
  const digits = word.replace(/,/g, '');
  if (/^\d+$/.test(digits)) return `(?<!\\d)(?<!\\d,)${digits.split('').join(',?')}(?!,?\\d)`;
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The search box's words: each one must match, and every match is marked. */
function searchOf(search: string) {
  const words = search.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  return { every: words.map((word) => new RegExp(wordPattern(word), 'i')), marks: new RegExp(`(${words.map(wordPattern).join('|')})`, 'gi') };
}

/** Text with the searched-for parts marked. */
function Marked({ text, marks }: { text: string; marks: RegExp | null }) {
  if (!marks) return <>{text}</>;
  return (
    <>
      {text.split(marks).map((part, index) =>
        index % 2 === 1 && part ? (
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

/** The filter column's width on a computer: the log's own, so the two halves match. */
const FILTER_WIDTH = '30rem';

const FIELD =
  'bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring/30 h-11 rounded-xl px-3.5 text-[0.9375rem] outline-none transition-colors focus-visible:ring-3 placeholder:text-muted-foreground disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]';

/** The line under the headers. */
const SEPARATOR = 'border-b border-black/[0.07] dark:border-white/[0.08]';

/** The days to read: the ones set, or the last two weeks; at most MAX_DAYS. */
function daysToRead(today: string, from: string, to: string): string[] {
  const last = to && to < today ? to : today;
  const first = from ? from : addDays(last, -(RECENT_DAYS - 1));
  const days: string[] = [];
  for (let day = last; day >= first && days.length < MAX_DAYS; day = addDays(day, -1)) days.push(day);
  return days;
}

/** A label–value row in a line's box: plain, a chip, a coloured tag, or the person who did it. */
type Detail = { label: string; value: string; as?: 'chip' | 'person' | 'category' };

/** Expenses are yellow throughout: the icon, and the category's tag. */
const CATEGORY_TAG = 'bg-[#fdecc8] text-[#402c1b] dark:bg-[#89632a] dark:text-[#fdf0d3]';

export function ActivityLog({ className, children }: { className?: string; children: React.ReactNode }) {
  const t = useTranslations('activityLog');
  const tActivity = useTranslations('activity');
  const tExpenses = useTranslations('expenses');
  const tRoles = useTranslations('roles');
  const locale = useLocale();
  const money = useShortMoney();
  const router = useRouter();
  const { workspace, can } = useWorkspace();
  const allowed = can('view_activity_own');
  const isMobile = useIsMobile();
  const rtl = directionOf(locale) === 'rtl';
  const [open, setOpen] = React.useState(false);
  // When it was opened: "4 hours ago" counts from then, fixed while it's open.
  const [openedAt, setOpenedAt] = React.useState(0);
  const [filtering, setFiltering] = React.useState(false);
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  const [sections, setSections] = React.useState<Set<Section>>(() => new Set<Section>(['activity', 'date']));
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const setView = (view: View) => setFilters((f) => ({ ...f, view, ...(hasAmount(view) ? {} : { minAmount: '', maxAmount: '' }) }));
  const toggleSection = (section: Section) =>
    setSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });

  // A opens (or closes) it from anywhere, as its tooltip says.
  React.useEffect(() => {
    if (!allowed) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'a') return;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      setOpenedAt(Date.now());
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed]);

  const today = businessDate(workspace.timeZone);
  const days = daysToRead(today, filters.fromDate, filters.toDate);
  const queries = useQueries({
    queries: days.map((day) => ({ queryKey: queryKeys.activity(workspace.id, day), queryFn: () => api.activity.list(workspace.id, day), enabled: allowed && open })),
  });
  if (!allowed) return null;

  const pending = queries.some((q) => q.isPending);
  const failed = queries.some((q) => q.isError);
  const fetching = queries.some((q) => q.isFetching);
  const all = queries
    .flatMap((q) => q.data ?? [])
    .sort((a, b) => b.activity.createdAt.localeCompare(a.activity.createdAt));

  const search = searchOf(filters.search);
  const min = filters.minAmount === '' ? null : Number(filters.minAmount);
  const max = filters.maxAmount === '' ? null : Number(filters.maxAmount);
  const fromAt = filters.fromDate ? `${filters.fromDate}T${filters.fromTime || '00:00'}` : '';
  const toAt = filters.toDate ? `${filters.toDate}T${filters.toTime || '23:59'}` : '';
  const narrowed = search !== null || filters.view !== 'all' || Boolean(filters.actor || filters.fromDate || filters.toDate) || min !== null || max !== null;

  /** "Today, 2:13pm", "Yesterday, 9:05am", "13 Nov, 7:43pm". */
  const whenOf = (iso: string) => {
    const at = new Date(iso);
    const local = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const now = new Date(openedAt);
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(at);
    const day =
      local(at) === local(now)
        ? t('today')
        : local(at) === local(yesterday)
          ? t('yesterday')
          : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) }).format(at);
    return `${day}, ${time}`;
  };
  /** "Just now", "4 hours ago", "2 days ago". */
  const agoOf = (iso: string) => {
    const minutes = Math.max(0, Math.round((openedAt - new Date(iso).getTime()) / 60_000));
    if (minutes < 1) return t('justNow');
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
    if (minutes < 60) return relative.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (hours < 24) return relative.format(-hours, 'hour');
    return relative.format(-Math.round(hours / 24), 'day');
  };

  /** The line's title: "Exchange recorded", "Day closed"… */
  const titleOf = (row: ActivityRow) => {
    const key = `titles.${row.activity.action}_${subjectOf(row)}`;
    return t.has(key as never) ? t(key as never) : t('titles.other');
  };
  /** The rows in its box: who, the amount, what it was about, the new right, the reason. */
  const detailsOf = (row: ActivityRow): Detail[] => {
    const rows: Detail[] = [{ label: t('by'), value: row.user.name, as: 'person' }];
    if (row.money) rows.push({ label: t('amount'), value: money(row.money) });
    if (row.detail) {
      const category = row.activity.recordType === 'expense' && tExpenses.has(`categories.${row.detail}` as never);
      rows.push(category ? { label: t('category'), value: tExpenses(`categories.${row.detail}` as never), as: 'category' } : { label: t('about'), value: row.detail });
    }
    const after = row.activity.after as { role?: unknown } | null;
    if (row.activity.action === 'change_role' && after && typeof after.role === 'string' && ['owner', 'editor', 'viewer'].includes(after.role)) {
      rows.push({ label: t('roleLabel'), value: tRoles(after.role as 'owner'), as: 'chip' });
    }
    if (row.activity.reason) rows.push({ label: t('reason'), value: row.activity.reason });
    return rows;
  };
  const searchText = (row: ActivityRow) => [titleOf(row), ...detailsOf(row).map(({ value }) => value), row.money ? fromMinor(Math.abs(row.money.amount), row.money.currency).toString() : ''].join(' ');
  /** Where a line's button goes. */
  const linkOf = (row: ActivityRow): { label: string; href: string } | null => {
    const to = metaOf(row).link;
    const day = row.activity.createdAt.slice(0, 10);
    if (to === 'profit') return { label: t('links.profit'), href: `/w/${workspace.id}/profit${day < today ? `?day=${day}` : ''}` };
    if (to === 'amanat') return { label: t('links.amanat'), href: `/w/${workspace.id}/amanat` };
    if (to === 'settings') return { label: t('links.settings'), href: `/w/${workspace.id}/settings` };
    if (to === 'shop') return { label: t('links.shop'), href: `/w/${workspace.id}` };
    return null;
  };

  const rows = all.filter((row) => {
    if (!inView(row, filters.view)) return false;
    if (filters.actor && row.user.id !== filters.actor) return false;
    if (fromAt && row.activity.createdAt.slice(0, 16) < fromAt) return false;
    if (toAt && row.activity.createdAt.slice(0, 16) > toAt) return false;
    if (search && !search.every.every((pattern) => pattern.test(searchText(row)))) return false;
    if (min !== null || max !== null) {
      if (!row.money) return false;
      const amount = Number(fromMinor(Math.abs(row.money.amount), row.money.currency).toString());
      if (min !== null && amount < min) return false;
      if (max !== null && amount > max) return false;
    }
    return true;
  });
  const shown = narrowed ? rows : rows.slice(0, LIMIT);
  const lastId = shown.at(-1)?.activity.id;
  const viewLabel = t(`views.${filters.view}`);
  const people = [...new Map(all.map((r) => [r.user.id, r.user.name])).entries()];
  const personName = (id: string) => people.find(([each]) => each === id)?.[1] ?? t('onePerson');

  /** The sheet gets out of the way, then the page opens. */
  const go = (href: string) => {
    setOpen(false);
    window.setTimeout(() => router.push(href), SHEET_CLOSE_MS);
  };

  const filterColumn = (
    <div className="flex h-full flex-col" style={isMobile ? undefined : { width: FILTER_WIDTH }}>
      <div className={cn('flex h-[4.25rem] shrink-0 items-center px-5 pt-2', SEPARATOR)}>
        <h3 className="text-lg font-medium tracking-tight">{t('filters')}</h3>
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <label className="flex flex-col gap-2">
          <span className="text-foreground text-sm font-semibold">{t('search')}</span>
          <span className={cn(FIELD, 'focus-within:ring-ring/30 flex items-center gap-2.5 focus-within:ring-3')}>
            <SearchIcon className="text-muted-foreground size-4 shrink-0" />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => set('search', event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
            />
          </span>
        </label>

        <div className="mt-3">
          <FilterSection title={t('activity')} summary={filters.view === 'all' ? undefined : viewLabel} open={sections.has('activity')} onToggle={() => toggleSection('activity')}>
            <PickSelect value={filters.view} onChange={(value) => setView(value as View)} placeholder={t('views.all')} options={VIEWS.map((value) => ({ value, label: t(`views.${value}`) }))} />
          </FilterSection>

          {can('view_activity_all') ? (
            <FilterSection title={t('by')} summary={filters.actor ? personName(filters.actor) : undefined} open={sections.has('staff')} onToggle={() => toggleSection('staff')}>
              <PickSelect
                value={filters.actor}
                onChange={(value) => set('actor', value)}
                placeholder={t('anyone')}
                options={[{ value: '', label: t('anyone') }, ...people.map(([id, name]) => ({ value: id, label: name }))]}
              />
            </FilterSection>
          ) : null}

          {/* Only money has an amount: not rates, closings or people. */}
          {hasAmount(filters.view) ? (
            <FilterSection
              title={t('amount')}
              summary={min !== null || max !== null ? `${min ?? t('any')} – ${max ?? t('any')}` : undefined}
              open={sections.has('amount')}
              onToggle={() => toggleSection('amount')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label={t('atLeast')}
                  placeholder={t('min')}
                  value={filters.minAmount}
                  onChange={(event) => set('minAmount', event.target.value)}
                  className={cn(FIELD, 'min-w-0 flex-1')}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  aria-label={t('atMost')}
                  placeholder={t('max')}
                  value={filters.maxAmount}
                  onChange={(event) => set('maxAmount', event.target.value)}
                  className={cn(FIELD, 'min-w-0 flex-1')}
                />
              </div>
            </FilterSection>
          ) : null}

          <FilterSection title={t('dateTime')} summary={filters.fromDate || filters.toDate ? t('set') : undefined} open={sections.has('date')} onToggle={() => toggleSection('date')} last>
            <div className="flex flex-col gap-3">
              {(['from', 'to'] as const).map((side) => (
                <div key={side} className="flex flex-col gap-1.5">
                  <span className="text-muted-foreground text-xs font-medium">{t(side)}</span>
                  <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] gap-2">
                    <input
                      type="date"
                      aria-label={t(`${side}Day`)}
                      value={side === 'from' ? filters.fromDate : filters.toDate}
                      max={side === 'from' ? filters.toDate || today : today}
                      min={side === 'to' ? filters.fromDate || undefined : undefined}
                      onChange={(event) => set(side === 'from' ? 'fromDate' : 'toDate', event.target.value)}
                      className={cn(FIELD, 'min-w-0')}
                    />
                    <input
                      type="time"
                      aria-label={t(`${side}Time`)}
                      value={side === 'from' ? filters.fromTime : filters.toTime}
                      disabled={side === 'from' ? !filters.fromDate : !filters.toDate}
                      onChange={(event) => set(side === 'from' ? 'fromTime' : 'toTime', event.target.value)}
                      className={cn(FIELD, 'min-w-0')}
                    />
                  </div>
                </div>
              ))}
            </div>
          </FilterSection>
        </div>
      </div>

      {/* Results shows the log (and, on a phone, goes back to it); Clear empties every filter. */}
      <div className="flex shrink-0 gap-2 border-t border-black/[0.07] p-4 max-md:pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => setFiltering(false)}
          className="bg-foreground text-background focus-visible:ring-3 focus-visible:ring-ring/30 h-11 flex-1 rounded-xl text-[0.9375rem] font-semibold outline-none transition-opacity hover:opacity-90"
        >
          {fetching ? t('resultsLoading') : t('results', { count: rows.length })}
        </button>
        <button
          type="button"
          onClick={() => setFilters(NO_FILTERS)}
          disabled={!narrowed}
          className="text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 h-11 rounded-xl bg-black/5 px-5 text-[0.9375rem] font-semibold outline-none transition-colors hover:bg-black/10 disabled:pointer-events-none disabled:opacity-40 dark:bg-white/10 dark:hover:bg-white/15"
        >
          {t('clear')}
        </button>
      </div>
    </div>
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setOpenedAt(Date.now());
        if (!next) setFiltering(false);
      }}
    >
      <Tooltip>
        <TooltipTrigger render={<SheetTrigger render={<button type="button" aria-label={t('title')} aria-keyshortcuts="A" className={className} />} />}>{children}</TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {t('title')} · A
        </TooltipContent>
      </Tooltip>

      <SheetContent
        // eslint-disable-next-line no-restricted-syntax -- the sheet's side is physical: the end of the page in either direction
        side={rtl ? 'left' : 'right'}
        showCloseButton={false}
        className={cn(
          // The notifications' panel, pale sage, floating clear of the edges. As wide as what's in it.
          'my-2 me-2 h-[calc(100svh-1rem)]! w-auto! max-w-[calc(100vw-1rem)]! gap-0 rounded-3xl border border-white/70 bg-[#e8ede8] p-0 shadow-none dark:border-white/10 dark:bg-neutral-950',
          'max-md:m-0 max-md:h-svh! max-md:w-full! max-md:max-w-none! max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="flex min-h-0 flex-1">
          {isMobile ? (
            filtering ? (
              <aside aria-label={t('filters')} className="min-w-0 flex-1">
                {filterColumn}
              </aside>
            ) : null
          ) : (
            <AnimatePresence initial={false}>
              {filtering ? (
                <motion.aside
                  key="filters"
                  aria-label={t('filters')}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: FILTER_WIDTH, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="shrink-0 overflow-hidden border-e border-black/[0.07] dark:border-white/[0.08]"
                >
                  {filterColumn}
                </motion.aside>
              ) : null}
            </AnimatePresence>
          )}

          <div className={cn('flex min-w-0 flex-col md:w-[30rem]', isMobile && 'flex-1', isMobile && filtering && 'hidden')}>
            <div className={cn('flex shrink-0 items-center justify-between gap-4 px-5 pt-5 pb-3', SEPARATOR)}>
              <div className="min-w-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<button type="button" className="focus-visible:ring-3 focus-visible:ring-ring/30 -ms-2 flex items-center gap-1.5 rounded-lg px-2 py-1 outline-none transition-colors hover:bg-black/5 dark:hover:bg-white/10" />}
                  >
                    <SheetTitle className="text-lg font-medium tracking-tight">{viewLabel}</SheetTitle>
                    <ChevronDownIcon className="text-muted-foreground size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="min-w-52 rounded-lg p-1.5 shadow-lg ring-0 dark:bg-black dark:shadow-none">
                    {VIEWS.map((value) => (
                      <DropdownMenuItem key={value} onClick={() => setView(value)} className="flex items-center gap-2 rounded-md py-2 ps-2.5 pe-2 text-sm">
                        <span className="flex-1">{t(`views.${value}`)}</span>
                        {filters.view === value ? <CheckIcon className="size-4" /> : <span className="size-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <SheetDescription className="sr-only">{t('description')}</SheetDescription>
              </div>
              <div className="-me-2 flex items-center gap-1">
                {/* Opens the filters; a dot while any are set. */}
                <button
                  type="button"
                  aria-label={filtering ? t('hideFilters') : t('searchAndFilter')}
                  aria-pressed={filtering}
                  title={filtering ? t('hideFilters') : t('searchAndFilter')}
                  onClick={() => setFiltering((f) => !f)}
                  className={cn(HEADER_BUTTON, 'relative', filtering && 'bg-black/5 dark:bg-white/10')}
                >
                  <SearchIcon />
                  {narrowed ? <span aria-hidden className="absolute end-1.5 top-1.5 size-2 rounded-full bg-blue-500" /> : null}
                </button>
                <SheetClose render={<button type="button" aria-label={tActivity('close')} title={tActivity('close')} className={HEADER_BUTTON} />}>
                  <XIcon />
                </SheetClose>
              </div>
            </div>

            {failed ? (
              <p role="alert" className="text-destructive px-6 py-10 text-center text-sm">
                {t('loadFailed')}
              </p>
            ) : pending ? (
              <div aria-hidden className="space-y-6 px-5 pt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="ps-7">
                    <span className="block h-4 w-48 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
                    <span className="mt-2 block h-3 w-32 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
                    <span className="bg-card mt-3 block h-28 animate-pulse rounded-xl opacity-70" />
                  </div>
                ))}
              </div>
            ) : shown.length > 0 ? (
              <ol aria-label={viewLabel} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8">
                {shown.map((row) => (
                  <li key={row.activity.id}>
                    <ActivityEntry
                      title={titleOf(row)}
                      meta={metaOf(row)}
                      when={whenOf(row.activity.createdAt)}
                      ago={agoOf(row.activity.createdAt)}
                      details={detailsOf(row)}
                      link={linkOf(row)}
                      last={row.activity.id === lastId}
                      onOpen={go}
                      marks={search?.marks ?? null}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <span className="bg-card flex size-12 items-center justify-center rounded-full">
                  <ActivityIcon className="text-muted-foreground size-5" />
                </span>
                <p className="text-foreground font-medium">{narrowed ? t('nothingMatches') : t('nothingYet')}</p>
                <p className="text-muted-foreground max-w-64 text-sm">{narrowed ? t('nothingMatchesBody') : t('nothingYetBody')}</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** One fold of the filter column: its name (and what's picked, when something is) on a row that opens and shuts it. */
function FilterSection({ title, summary, open, onToggle, last = false, children }: { title: string; summary?: string; open: boolean; onToggle: () => void; last?: boolean; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className={cn(!last && SEPARATOR)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="focus-visible:ring-ring/30 flex w-full items-center gap-3 rounded-lg py-3.5 text-start outline-none focus-visible:ring-3">
        <span className="text-foreground text-sm font-semibold">{title}</span>
        {summary && !open ? <span className="text-muted-foreground min-w-0 flex-1 truncate text-end text-sm">{summary}</span> : <span className="flex-1" />}
        <ChevronDownIcon className={cn('text-muted-foreground size-4 shrink-0 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div id={id} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <div className="pb-4">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** One step down the timeline: its icon on the line, the title, when, then a box of label–value rows with a button to the page it's about. */
function ActivityEntry({
  title,
  meta,
  when,
  ago,
  details,
  link,
  last,
  onOpen,
  marks,
}: {
  title: string;
  meta: ActionMeta;
  when: string;
  ago: string;
  details: Detail[];
  link: { label: string; href: string } | null;
  last: boolean;
  onOpen: (href: string) => void;
  marks: RegExp | null;
}) {
  const Icon = meta.icon;
  return (
    <div className={cn('relative ps-7', !last && 'pb-7')}>
      {!last ? <span aria-hidden className="absolute start-[7px] top-6 bottom-0 w-px bg-black/10 dark:bg-white/10" /> : null}
      <Icon aria-hidden className={cn('absolute start-0 top-[3px] size-4', TONES[meta.tone])} />

      <p className="text-foreground text-[0.9375rem] leading-snug font-semibold">
        <Marked text={title} marks={marks} />
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {when}
        <span className="mx-1.5 opacity-50">|</span>
        {ago}
      </p>

      <div className="bg-card mt-3 rounded-xl border border-black/[0.06] p-3 dark:border-white/[0.06]">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2.5 text-[0.8125rem]">
          {details.map(({ label, value, as }) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-foreground min-w-0 text-end">
                {as === 'chip' ? (
                  <span className="bg-muted inline-block max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium">
                    <Marked text={value} marks={marks} />
                  </span>
                ) : as === 'category' ? (
                  <span className={cn('inline-flex h-6 max-w-full items-center truncate rounded-[4px] px-2 text-xs font-medium', CATEGORY_TAG)}>
                    <Marked text={value} marks={marks} />
                  </span>
                ) : as === 'person' ? (
                  <span className="block truncate font-semibold">
                    <Marked text={value} marks={marks} />
                  </span>
                ) : (
                  <span dir="auto" className="block break-words">
                    <Marked text={value} marks={marks} />
                  </span>
                )}
              </dd>
            </React.Fragment>
          ))}
        </dl>

        {link ? (
          <Link
            href={link.href}
            onClick={(event) => {
              event.preventDefault();
              onOpen(link.href);
            }}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] py-2 text-[0.8125rem] font-medium outline-none transition-colors hover:bg-black/[0.04] dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
          >
            {link.label}
            <ArrowUpRightIcon className="size-4 rtl:-scale-x-100" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
