'use client';

import { ArrowDownIcon, ArrowUpIcon, CornerDownLeftIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from '@/i18n/navigation';
import { maskStyle } from '@/lib/mask';
import { cn } from '@/lib/utils';

import { type PillTone, type ScopeId, SCOPES, type SearchEntry, type SearchKind, useSearchEntries } from './search-index';
import { matchRanges, matchScore, queryWords, SLIP_SCORE } from './search-match';

// Search, as Barista's: the box in the top bar, and Ctrl+K anywhere, open one
// panel: the field, what to look in, and the results. It finds pages, shops
// and accounts by any word in them, a slip in the spelling allowed. Each
// result is one clean line (the icon, the name, what tells it apart) and
// opens that very thing.

const GRADIENTS = {
  green: 'linear-gradient(135deg,#ffd600,#00d078)',
  pink: 'linear-gradient(135deg,#ff51e3,#1b4dff)',
  blue: 'linear-gradient(135deg,#06b6d4,#1b4dff)',
  emerald: 'linear-gradient(135deg,#00d078,#06b6d4)',
  grey: 'linear-gradient(135deg,#a1a1aa,#71717a)',
};

/** Each sidebar icon in its colour. */
const FILE_GRADIENTS: Record<string, string> = {
  '/home.svg': GRADIENTS.green,
  '/book.svg': GRADIENTS.pink,
  '/report.svg': GRADIENTS.blue,
  '/amanat.svg': GRADIENTS.emerald,
  '/settings.svg': GRADIENTS.grey,
  '/trash.svg': GRADIENTS.grey,
};

/** Each kind's icon. */
const KIND_ICONS: Record<SearchKind, string> = {
  page: '/home.svg',
  shop: '/home.svg',
  account: '/amanat.svg',
};

function ResultIcon({ entry }: { entry: SearchEntry }) {
  const file = entry.icon ?? KIND_ICONS[entry.kind];
  return <span aria-hidden className="size-5 shrink-0" style={{ ...maskStyle(file), backgroundImage: FILE_GRADIENTS[file] ?? GRADIENTS.green }} />;
}

const PILL_CLASSES: Record<PillTone, string> = {
  emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  cyan: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-400',
  orange: 'bg-orange-500/12 text-orange-700 dark:text-orange-400',
  muted: 'bg-muted text-muted-foreground',
};

/** How many of each kind the All tab shows before "Show all". */
const PER_KIND = 4;
/** How many one tab shows at most. */
const PER_TAB = 60;
/** How long the typing settles before the results move; the skeleton shows meanwhile. */
const SETTLE_MS = 140;

/** What was opened lately: the last 8, only which things (kind:id). */
const RECENT_KEY = 'amanat.search.recent';
const RECENT_MAX = 8;

function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecent(keys: string[]) {
  try {
    if (keys.length === 0) window.localStorage.removeItem(RECENT_KEY);
    else window.localStorage.setItem(RECENT_KEY, JSON.stringify(keys));
  } catch {
    // Not remembered this time.
  }
}

function rememberRecent(key: string) {
  saveRecent([key, ...readRecent().filter((each) => each !== key)].slice(0, RECENT_MAX));
}

/** A key, as the footer shows it. */
function Key({ children }: { children: ReactNode }) {
  return <kbd className="bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md px-1.5 font-sans text-[0.6875rem] font-semibold">{children}</kbd>;
}

/** The title, with what was typed underlined. */
function Underlined({ text, words }: { text: string; words: string[] }) {
  const ranges = matchRanges(text, words);
  if (ranges.length === 0) return <>{text}</>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <span key={start} className="decoration-foreground/40 underline decoration-[1.5px] underline-offset-4">
        {text.slice(start, end)}
      </span>,
    );
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

interface Section {
  id: string;
  heading: string;
  entries: SearchEntry[];
  /** On the All tab: how many there are in all, and the tab that shows them. */
  more?: { count: number; scope: ScopeId };
  /** Recent: can be cleared. */
  clearable?: boolean;
}

function scopeOf(kind: SearchKind): ScopeId {
  return SCOPES.find((scope) => scope.kinds?.some((each) => each === kind))?.id ?? 'all';
}

type Hit = { entry: SearchEntry; score: number };

/** What's found for the words typed, best first. */
function rank(entries: SearchEntry[], words: string[]): Hit[] {
  const found = entries
    .map((entry) => ({ entry, score: matchScore(entry.match, words) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date));
  // Spelt right somewhere: the near misses are only noise then.
  const exact = found.some(({ score }) => score >= SLIP_SCORE);
  return exact ? found.filter(({ score }) => score >= SLIP_SCORE) : found;
}

/** Result for one row: its icon, its name with the match underlined, what tells it apart, its pill, and Open while picked. */
function ResultRow({ entry, words, active, index, onHover, onOpen }: { entry: SearchEntry; words: string[]; active: boolean; index: number; onHover: () => void; onOpen: () => void }) {
  const t = useTranslations('search');
  return (
    <div
      role="option"
      aria-selected={active}
      data-index={index}
      onMouseMove={onHover}
      onClick={onOpen}
      className={cn('flex h-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm', active ? 'bg-muted' : 'hover:bg-muted/60')}
    >
      <ResultIcon entry={entry} />
      <span className="text-foreground min-w-0 shrink truncate text-[0.9375rem] font-medium">
        <Underlined text={entry.title} words={words} />
      </span>
      {entry.detail ? <span className="text-muted-foreground min-w-0 flex-1 truncate">{entry.detail}</span> : <span className="flex-1" />}
      {entry.pill ? <span className={cn('inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium', PILL_CLASSES[entry.pill.tone])}>{entry.pill.label}</span> : null}
      {active ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={t('open')}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                className="bg-foreground text-background flex size-7 shrink-0 items-center justify-center rounded-md max-md:hidden"
              />
            }
          >
            <CornerDownLeftIcon className="size-3.5 rtl:-scale-x-100" />
          </TooltipTrigger>
          <TooltipContent>{t('openEnter')}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** While the typing settles: grey lines where the results will be. */
function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-1 pt-1" aria-hidden>
      <Skeleton className="mb-2 h-3 w-16 rounded-full" />
      {[92, 78, 86, 64, 72].map((width, index) => (
        <div key={index} className="flex h-11 items-center gap-3 px-2">
          <Skeleton className="size-5 shrink-0 rounded-md" />
          <Skeleton className="h-3.5 rounded-full" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

/** The search panel. The top bar's box and Ctrl+K open it (useCommandPalette). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('search');
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [settled, setSettled] = useState('');
  const [scope, setScope] = useState<ScopeId>('all');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useSearchEntries(open);

  // What was opened lately, fresh each time it opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRecent(readRecent());
  }

  // The results follow the typing a moment later; straight away once it's cleared.
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query), query.trim() ? SETTLE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query]);
  const settling = query.trim() !== '' && query.trim() !== settled.trim();

  const words = queryWords(settled);
  const hits = useMemo(() => {
    const typed = queryWords(settled);
    return typed.length === 0 ? null : rank(entries, typed);
  }, [entries, settled]);

  const headings: Record<SearchKind, string> = { page: t('kinds.page'), shop: t('kinds.shop'), account: t('kinds.account') };
  const sections: Section[] = (() => {
    const kinds = SCOPES.find(({ id }) => id === scope)?.kinds ?? null;
    const inKinds = (kind: SearchKind) => !kinds || (kinds as readonly SearchKind[]).includes(kind);
    const inScope = entries.filter(({ kind }) => inKinds(kind));
    if (!hits) {
      const byKey = new Map(inScope.map((entry) => [entry.key, entry]));
      const recentEntries = recent.flatMap((key) => byKey.get(key) ?? []);
      const recentSection: Section[] = recentEntries.length > 0 ? [{ id: 'recent', heading: t('recent'), entries: recentEntries, clearable: true }] : [];
      if (scope !== 'all') return [...recentSection, { id: 'latest', heading: headings[kinds![0]!], entries: inScope.filter((entry) => !recentEntries.includes(entry)).slice(0, PER_TAB) }];
      return [
        ...recentSection,
        { id: 'pages', heading: t('goTo'), entries: inScope.filter(({ kind }) => kind === 'page').slice(0, 7) },
        { id: 'shops', heading: headings.shop, entries: inScope.filter(({ kind }) => kind === 'shop') },
      ];
    }
    const found = hits.filter(({ entry }) => inKinds(entry.kind));
    if (scope !== 'all') return [{ id: scope, heading: t('results'), entries: found.slice(0, PER_TAB).map(({ entry }) => entry) }];
    const byKind = new Map<SearchKind, Hit[]>();
    for (const hit of found) byKind.set(hit.entry.kind, [...(byKind.get(hit.entry.kind) ?? []), hit]);
    return [...byKind]
      .sort((a, b) => b[1][0]!.score - a[1][0]!.score)
      .map(([kind, kindHits]) => ({
        id: kind,
        heading: headings[kind],
        entries: kindHits.slice(0, PER_KIND).map(({ entry }) => entry),
        more: kindHits.length > PER_KIND ? { count: kindHits.length, scope: scopeOf(kind) } : undefined,
      }));
  })();
  const flat = sections.flatMap(({ entries: each }) => each);
  const counts = hits ? new Map(SCOPES.map(({ id, kinds }) => [id, kinds ? hits.filter(({ entry }) => (kinds as readonly SearchKind[]).includes(entry.kind)).length : hits.length])) : null;

  // Back to the top whenever what's shown changes.
  const [shownFor, setShownFor] = useState(`${settled}|${scope}`);
  if (shownFor !== `${settled}|${scope}`) {
    setShownFor(`${settled}|${scope}`);
    setActive(0);
  }
  // The picked one kept in view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => {
    onClose();
    setQuery('');
    setSettled('');
    setScope('all');
  };

  const openEntry = (entry: SearchEntry) => {
    rememberRecent(entry.key);
    close();
    router.push(entry.href);
  };

  const stepScope = (by: number) => {
    const at = SCOPES.findIndex(({ id }) => id === scope);
    setScope(SCOPES[(at + by + SCOPES.length) % SCOPES.length]!.id);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length));
    } else if (event.key === 'Enter') {
      const entry = flat[active];
      if (!entry) return;
      event.preventDefault();
      openEntry(entry);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      stepScope(event.shiftKey ? -1 : 1);
    }
  };

  let index = -1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border-border dark:bg-background top-[12svh] block translate-y-0 gap-0 overflow-hidden rounded-xl border bg-white p-0 shadow-none sm:max-w-3xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">{t('placeholder')}</DialogTitle>
        <DialogDescription className="sr-only">{t('description')}</DialogDescription>

        <div className="flex items-center gap-3 px-5 pt-4">
          <SearchIcon className="text-muted-foreground size-5 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('fieldPlaceholder')}
            aria-label={t('placeholder')}
            role="combobox"
            aria-expanded
            aria-controls="search-results"
            autoComplete="off"
            spellCheck={false}
            className="placeholder:text-muted-foreground/70 h-12 min-w-0 flex-1 bg-transparent text-lg outline-none"
          />
          {query ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t('clear')}
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="bg-muted text-muted-foreground hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
                  />
                }
              >
                <XIcon className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{t('clear')}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        <div role="tablist" aria-label={t('lookIn')} className="border-border flex gap-5 overflow-x-auto border-b px-5 pt-2 [scrollbar-width:none]">
          {SCOPES.map((option) => {
            const count = counts?.get(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                tabIndex={-1}
                aria-selected={scope === option.id}
                onClick={() => {
                  setScope(option.id);
                  inputRef.current?.focus();
                }}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-sm transition-colors',
                  scope === option.id ? 'border-foreground text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {t(`scopes.${option.id}`)}
                {count !== undefined && count > 0 && option.id !== 'all' ? <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[0.6875rem] font-semibold tabular-nums">{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div ref={listRef} id="search-results" role="listbox" aria-label={t('results')} className="flex h-[min(60svh,30rem)] flex-col overflow-y-auto px-3 py-3">
          {settling ? (
            <ResultsSkeleton />
          ) : flat.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              {/* In dark mode its black and white swap, the yellow kept. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/illustrations/finding-seek.svg" alt="" width={200} height={200} className="mb-2 size-40 dark:hue-rotate-180 dark:invert" />
              <p className="text-foreground text-sm font-medium">{settled.trim() ? t('nothingFound', { query: settled.trim() }) : t('nothingYet')}</p>
              {settled.trim() && scope !== 'all' ? (
                <button type="button" onClick={() => setScope('all')} className="text-foreground text-sm font-medium underline underline-offset-4">
                  {t('everywhere')}
                </button>
              ) : null}
            </div>
          ) : (
            sections.map((section) =>
              section.entries.length === 0 ? null : (
                <div key={section.id} className="mb-2 flex flex-col" role="group" aria-label={section.heading}>
                  <div className="flex items-center justify-between px-3 pt-1 pb-1">
                    <p className="text-muted-foreground text-xs font-medium">{section.heading}</p>
                    {section.clearable ? (
                      <button
                        type="button"
                        onClick={() => {
                          saveRecent([]);
                          setRecent([]);
                          inputRef.current?.focus();
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs font-medium"
                      >
                        {t('clear')}
                      </button>
                    ) : null}
                    {section.more ? (
                      <button
                        type="button"
                        onClick={() => {
                          setScope(section.more!.scope);
                          inputRef.current?.focus();
                        }}
                        className="text-muted-foreground hover:text-foreground text-xs font-medium"
                      >
                        {t('showAll', { count: section.more.count })}
                      </button>
                    ) : null}
                  </div>
                  {section.entries.map((entry) => {
                    index += 1;
                    const at = index;
                    return <ResultRow key={`${section.id}:${entry.key}`} entry={entry} words={words} active={active === at} index={at} onHover={() => setActive(at)} onOpen={() => openEntry(entry)} />;
                  })}
                </div>
              ),
            )
          )}
        </div>

        <div className="border-border text-muted-foreground flex items-center gap-4 border-t px-5 py-3 text-xs max-md:hidden">
          <span className="flex items-center gap-1.5">
            <Key>
              <ArrowUpIcon className="size-3" />
            </Key>
            <Key>
              <ArrowDownIcon className="size-3" />
            </Key>
            {t('toMove')}
          </span>
          <span className="flex items-center gap-1.5">
            <Key>
              <CornerDownLeftIcon className="size-3 rtl:-scale-x-100" />
            </Key>
            {t('toOpen')}
          </span>
          <span className="flex items-center gap-1.5">
            <Key>Tab</Key>
            {t('toSwitch')}
          </span>
          <span className="ms-auto flex items-center gap-1.5">
            <Key>Esc</Key>
            {t('toClose')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Ctrl+K (⌘K on a Mac) opens the search from anywhere, and closes it again. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}
