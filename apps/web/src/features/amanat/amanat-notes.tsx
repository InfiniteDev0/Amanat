'use client';

import { type AmanatRow, businessDate, type Id, type Workspace } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { ChevronRightIcon, ChevronsLeftIcon, HandCoinsIcon, PanelLeftIcon, PencilIcon, PlusIcon, RotateCcwIcon, SearchIcon, StarIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState, useSyncExternalStore } from 'react';

import { AdminButton, Modal } from '@/components/barista-modal';
import { DateWheel } from '@/components/date-wheel';
import { CalendarMarkGlyph } from '@/components/glyphs';
import { colourFor } from '@/components/shop-badge';
import { useShortMoney } from '@/features/profit/money-text';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { inScope, useShopScope } from '@/features/workspaces/shop-scope';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { errorKey, useMessage } from '@/lib/api/errors';
import { cn } from '@/lib/utils';

import { AmanatDialog } from './amanat-dialog';
import { useAmanatOfShops, useDeleteAmanat, useHighlightAmanat, useRestoreAmanat, useReturnAny, useTrashAmanat, useTrashedAmanat, useUndoReturnAny } from './queries';

/*
 * The Amanat page, as Milo's Notes: in two sections. On the left, Amanat with
 * search and «, All amanat with its count, then your shops (each a coloured
 * square, its count; pick one to see only its amanat). On the right, the tabs
 * (All amanat, By shop, Recent, Highlighted, Trash) with the calendar and New
 * at the end, then each customer's amanat as a card: the amount on its cover,
 * then the customer, the shop and when (Today, Yesterday, then the date). A
 * card opens its dialog: everything about it, and Given back, Highlight, Trash.
 */

/** A count in a small grey box, as Milo's tabs have them. */
const COUNT = 'rounded-sm bg-foreground/[0.08] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-foreground/75 dark:bg-muted dark:font-normal dark:text-muted-foreground';
/** Milo's box: the bar's labels and quiet buttons. */
const BOX = 'flex h-7 items-center rounded-sm border border-foreground/20 px-2.5 text-[13px] tabular-nums dark:border-border';
const SIDE_ICON = 'flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground';
const ITEM = 'flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-start text-sm transition-colors';
const EASE = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

type Tab = 'all' | 'shops' | 'recent' | 'highlighted' | 'trash';
const TABS: Tab[] = ['all', 'shops', 'recent', 'highlighted', 'trash'];

/* ── On this device: whether the left section is open, and what was opened today ─── */

const SIDE_KEY = 'amanat.amanat-side';
const RECENT_KEY = 'amanat.amanat-recent';
const sideListeners = new Set<() => void>();
const readSide = () => {
  try {
    return window.localStorage.getItem(SIDE_KEY) !== 'closed';
  } catch {
    return true;
  }
};
const setSide = (open: boolean) => {
  try {
    window.localStorage.setItem(SIDE_KEY, open ? 'open' : 'closed');
  } catch {
    // Kept for this visit only.
  }
  sideListeners.forEach((listener) => listener());
};
const subscribeSide = (listener: () => void) => {
  sideListeners.add(listener);
  return () => sideListeners.delete(listener);
};

/** The amanat opened today: id → when. Yesterday's are let go. */
function readRecent(): Record<string, number> {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '{}') as { day?: string; opened?: Record<string, number> };
    return saved.day === new Date().toDateString() ? (saved.opened ?? {}) : {};
  } catch {
    return {};
  }
}
const recentListeners = new Set<() => void>();
const subscribeRecent = (listener: () => void) => {
  recentListeners.add(listener);
  return () => recentListeners.delete(listener);
};
/** The same object until something is opened, so React sees no change in between. */
let recentCache: { raw: string | null; value: Record<string, number> } = { raw: null, value: {} };
function recentSnapshot(): Record<string, number> {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECENT_KEY);
  } catch {
    // Storage blocked: nothing opened.
  }
  if (raw !== recentCache.raw) recentCache = { raw, value: readRecent() };
  return recentCache.value;
}
const NONE: Record<string, number> = {};
function rememberOpened(id: string) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify({ day: new Date().toDateString(), opened: { ...readRecent(), [id]: Date.now() } }));
  } catch {
    // Not remembered this time.
  }
  recentListeners.forEach((listener) => listener());
}

/* ── Words ───────────────────────────────────────────────────────────── */

/** Today, Yesterday, then the date ("Nov 20", with the year when it isn't this one). */
export function useDayLabel() {
  const t = useTranslations('amanatNotes');
  const locale = useLocale();
  return (date: string, today: string) => {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
    if (days === 0) return t('today');
    if (days === 1) return t('yesterday');
    const at = new Date(`${date}T12:00:00Z`);
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(at);
  };
}

/* ── The card ────────────────────────────────────────────────────────── */

/** One customer's amanat, as Milo's note card: the amount on the cover, then the customer, the shop, when. */
export function AmanatCard({ row, shop, day, onOpen, onHighlight }: { row: AmanatRow; shop: Workspace | undefined; day: string; onOpen: () => void; onHighlight: () => void }) {
  const t = useTranslations('amanatNotes');
  const money = useShortMoney();
  const { amanat } = row;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group/note bg-card ring-foreground/25 flex h-64 cursor-pointer flex-col overflow-hidden rounded-lg text-start transition-shadow hover:ring-1"
    >
      {/* The cover: the amount, large, and where it sits; a highlighted one on green paper. */}
      <div className={cn('relative min-h-0 flex-1 overflow-hidden p-4', amanat.highlighted ? 'bg-emerald-900/60 dark:bg-emerald-950' : 'bg-foreground/[0.05]')}>
        <span
          className={cn(
            'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
            row.returned ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
          )}
        >
          {row.returned ? t('givenBack') : t('held')}
        </span>
        <p dir="ltr" className={cn('mt-4 text-start text-3xl font-semibold tracking-tight tabular-nums', row.returned && 'text-muted-foreground line-through decoration-2')}>
          {money({ amount: amanat.amount, currency: amanat.currency })}
        </p>
        <p className="text-muted-foreground mt-1 truncate text-sm">{t('inAccount', { account: row.account.name })}</p>
        {amanat.note ? <p className="text-foreground/60 mt-3 line-clamp-2 text-[13px] leading-relaxed">{amanat.note}</p> : null}

        {/* On hover, top end: the star (Highlight); it stays while highlighted. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onHighlight();
          }}
          aria-pressed={Boolean(amanat.highlighted)}
          aria-label={amanat.highlighted ? t('unhighlight') : t('highlight')}
          className={cn(
            'absolute end-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-md bg-black/80 transition-opacity focus-visible:opacity-100',
            amanat.highlighted ? 'opacity-100' : 'opacity-0 group-hover/note:opacity-100',
          )}
        >
          <StarIcon className={cn('size-3.5', amanat.highlighted ? 'text-[#f5c542]' : 'text-white')} fill={amanat.highlighted ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* The customer, the shop, when: the one part with an edge. */}
      <div className="border-foreground/10 flex shrink-0 flex-col gap-2 rounded-b-lg border border-t-0 px-4 py-3 group-hover/note:border-transparent">
        <h3 className="truncate text-base font-medium">{row.clientName}</h3>
        <div className="flex items-center justify-between gap-2">
          {shop ? <span className={cn('truncate rounded-sm px-2 py-0.5 text-xs font-medium text-white', colourFor(shop.id))}>{shop.name}</span> : <span />}
          <span className="text-muted-foreground shrink-0 text-xs">{day}</span>
        </div>
      </div>
    </div>
  );
}

function CardsGrid({ rows, children }: { rows: number; children: ReactNode }) {
  return rows === 0 ? null : <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

/* ── The dialog a card opens ─────────────────────────────────────────── */

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground min-w-0 text-end font-medium">{children}</span>
    </div>
  );
}

export function AmanatDetails({ row, shop, today, onClose, onEdit }: { row: AmanatRow | null; shop: Workspace | undefined; today: string; onClose: () => void; onEdit: (row: AmanatRow) => void }) {
  const t = useTranslations('amanatNotes');
  const locale = useLocale();
  const money = useShortMoney();
  const message = useMessage();
  const dayLabel = useDayLabel();
  const giveBack = useReturnAny();
  const undo = useUndoReturnAny();
  const highlight = useHighlightAmanat();
  const trash = useTrashAmanat();
  const restore = useRestoreAmanat();
  if (!row) {
    return (
      <Modal open={false} onClose={onClose} title="">
        {null}
      </Modal>
    );
  }
  const { amanat } = row;
  const shopId = amanat.workspaceId;
  const failed = (error: unknown) => gooeyToast.error(message(errorKey(error)));
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(amanat.createdAt));
  const backToday = Boolean(amanat.returnedAt) && amanat.returnedAt!.slice(0, 10) === new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open
      onClose={onClose}
      title={row.clientName}
      description={`${money({ amount: amanat.amount, currency: amanat.currency })} · ${shop?.name ?? ''}`}
      footer={
        <>
          <AdminButton
            variant="ghost"
            Icon={Trash2Icon}
            onClick={() =>
              trash.mutateAsync({ shopId, id: amanat.id }).then(() => {
                onClose();
                gooeyToast.success(t('trashed', { name: row.clientName }), {
                  action: { label: t('undo'), successLabel: t('restored'), onClick: () => void restore.mutateAsync({ shopId, id: amanat.id }) },
                });
              }, failed)
            }
          >
            {t('toTrash')}
          </AdminButton>
          <AdminButton variant="secondary" Icon={PencilIcon} onClick={() => onEdit(row)}>
            {t('edit')}
          </AdminButton>
          <AdminButton variant="secondary" Icon={StarIcon} onClick={() => highlight.mutateAsync({ shopId, id: amanat.id, on: !amanat.highlighted }).then(onClose, failed)}>
            {amanat.highlighted ? t('unhighlight') : t('highlight')}
          </AdminButton>
          {row.returned ? (
            backToday ? (
              <AdminButton variant="secondary" Icon={RotateCcwIcon} disabled={undo.isPending} onClick={() => undo.mutateAsync({ shopId, id: amanat.id }).then(onClose, failed)}>
                {t('undoGiveBack')}
              </AdminButton>
            ) : null
          ) : (
            <AdminButton
              variant="primary"
              Icon={HandCoinsIcon}
              disabled={giveBack.isPending}
              onClick={() =>
                giveBack.mutateAsync({ shopId, id: amanat.id }).then(() => {
                  onClose();
                  gooeyToast.success(t('gaveBack', { name: row.clientName }));
                }, failed)
              }
            >
              {t('giveBack')}
            </AdminButton>
          )}
        </>
      }
    >
      <div className="divide-foreground/10 divide-y">
        <Detail label={t('status')}>{row.returned ? t('givenBack') : t('held')}</Detail>
        <Detail label={t('amount')}>
          <span dir="ltr">{money({ amount: amanat.amount, currency: amanat.currency })}</span>
        </Detail>
        <Detail label={t('into')}>{row.account.name}</Detail>
        <Detail label={t('shop')}>{shop?.name ?? '—'}</Detail>
        <Detail label={t('when')}>{`${dayLabel(amanat.date, today)}, ${time}`}</Detail>
        <Detail label={t('by')}>{row.recordedBy.name}</Detail>
        {amanat.note ? <Detail label={t('note')}>{amanat.note}</Detail> : null}
      </div>
    </Modal>
  );
}

/* ── Trash ───────────────────────────────────────────────────────────── */

function TrashView({ rows, shopOf, today }: { rows: AmanatRow[]; shopOf: (id: Id) => Workspace | undefined; today: string }) {
  const t = useTranslations('amanatNotes');
  const money = useShortMoney();
  const dayLabel = useDayLabel();
  const message = useMessage();
  const restore = useRestoreAmanat();
  const remove = useDeleteAmanat();
  const failed = (error: unknown) => gooeyToast.error(message(errorKey(error)));
  if (rows.length === 0) return <p className="text-muted-foreground px-5 pt-10 text-sm">{t('trashEmpty')}</p>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="text-muted-foreground flex shrink-0 items-center gap-3 px-5 py-3 text-sm">
        <span className="flex-1">{t('inTrash', { count: rows.length })}</span>
        <button
          type="button"
          onClick={() => rows.forEach((row) => remove.mutateAsync({ shopId: row.amanat.workspaceId, id: row.amanat.id }).catch(failed))}
          className={cn(BOX, 'cursor-pointer gap-1.5 text-[#ef4444] transition-colors hover:bg-[#ef4444]/10')}
        >
          <Trash2Icon className="size-3.5" />
          {t('emptyTrash')}
        </button>
      </div>
      <div className="scrollbar-pill min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li key={row.amanat.id} className="border-foreground/10 bg-card flex flex-col gap-3 rounded-lg border p-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-medium">{row.clientName}</h3>
                <p className="text-muted-foreground text-xs">
                  <span dir="ltr">{money({ amount: row.amanat.amount, currency: row.amanat.currency })}</span> · {shopOf(row.amanat.workspaceId)?.name} · {dayLabel(row.amanat.date, today)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => restore.mutateAsync({ shopId: row.amanat.workspaceId, id: row.amanat.id }).catch(failed)}
                  className={cn(BOX, 'hover:bg-muted cursor-pointer gap-1.5 transition-colors')}
                >
                  <RotateCcwIcon className="size-3.5" />
                  {t('restore')}
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutateAsync({ shopId: row.amanat.workspaceId, id: row.amanat.id }).catch(failed)}
                  className={cn(BOX, 'text-muted-foreground cursor-pointer gap-1.5 transition-colors hover:bg-[#ef4444]/10 hover:text-[#ef4444]')}
                >
                  <Trash2Icon className="size-3.5" />
                  {t('deleteForever')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── The left section ────────────────────────────────────────────────── */

function SidePanel({
  rows,
  shops,
  place,
  onPlace,
  query,
  onQuery,
  onClose,
  onOpen,
}: {
  rows: AmanatRow[];
  shops: Workspace[];
  place: Id | null;
  onPlace: (id: Id | null) => void;
  query: string;
  onQuery: (query: string) => void;
  onClose: () => void;
  onOpen: (row: AmanatRow) => void;
}) {
  const t = useTranslations('amanatNotes');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<Set<Id>>(() => new Set());
  const searchOpen = searching || Boolean(query);
  const closeSearch = () => {
    onQuery('');
    setSearching(false);
  };
  const toggle = (id: Id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <aside className="border-border flex w-[17rem] shrink-0 flex-col gap-4 border-e px-3 pt-3 pb-3 max-md:w-full">
      {/* Its name, then search and « (close the section). */}
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex h-8 items-center gap-1 ps-1.5">
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{t('title')}</span>
          <button type="button" onClick={() => (searchOpen ? closeSearch() : setSearching(true))} aria-label={t('search')} aria-pressed={searchOpen} className={cn(SIDE_ICON, searchOpen && 'bg-foreground/[0.06] text-foreground')}>
            <SearchIcon className="size-4" />
          </button>
          <button type="button" onClick={onClose} aria-label={t('closeSide')} className={SIDE_ICON}>
            <ChevronsLeftIcon className="size-4 rtl:rotate-180" />
          </button>
        </div>
        {searchOpen ? (
          <label className="border-foreground/20 bg-card dark:border-border flex h-9 items-center gap-2 rounded-md border px-2.5">
            <SearchIcon className="text-muted-foreground size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              onBlur={() => !query && setSearching(false)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('search')}
              className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {query ? (
              <button type="button" onClick={closeSearch} aria-label={t('clearSearch')} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </label>
        ) : null}
      </div>

      {/* Every amanat: the way back from a shop. */}
      <button type="button" onClick={() => onPlace(null)} className={cn(ITEM, place === null ? 'bg-[#2f80ed]/10 font-medium text-[#2f80ed]' : 'text-foreground/80 hover:bg-foreground/[0.04]')}>
        <HandCoinsIcon className="size-4 shrink-0" />
        <span className="flex-1">{t('allAmanat')}</span>
        <span className={COUNT}>{rows.length}</span>
      </button>

      <div className="bg-border h-px shrink-0" />

      {/* Your shops: the colour as a square (the chevron on hover opens its customers), and the count. */}
      <nav aria-label={t('shops')} className="scrollbar-pill -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {shops.map((shop) => {
          const mine = rows.filter((row) => row.amanat.workspaceId === shop.id);
          const isOpen = open.has(shop.id);
          return (
            <div key={shop.id}>
              <div className={cn('group/cat hover:bg-foreground/6 flex h-9 items-center gap-1.5 rounded-sm px-1.5 text-sm font-medium transition-colors', place === shop.id && 'bg-foreground/6')}>
                <button
                  type="button"
                  onClick={() => toggle(shop.id)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? t('closeShop', { shop: shop.name }) : t('openShop', { shop: shop.name })}
                  className="hover:bg-foreground/10 relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm transition-colors"
                >
                  <span className={cn('size-4 rounded-sm group-hover/cat:invisible', colourFor(shop.id))} />
                  <ChevronRightIcon className={cn('text-muted-foreground absolute size-4 opacity-0 transition-[rotate,opacity] group-hover/cat:opacity-100 rtl:-scale-x-100', EASE, isOpen && 'rotate-90')} />
                </button>
                <button type="button" onClick={() => onPlace(shop.id)} className="min-w-0 flex-1 cursor-pointer truncate text-start">
                  {shop.name}
                </button>
                <span className="text-muted-foreground shrink-0 pe-1 text-xs tabular-nums">{mine.length}</span>
              </div>
              {/* Its customers, on a guide line under the square. */}
              <div className={cn('grid transition-[grid-template-rows,opacity]', EASE, isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')} inert={!isOpen}>
                <div className="min-h-0 overflow-hidden">
                  <ul className={cn('border-foreground/15 ms-[1.1rem] mb-1 border-s transition-[translate,filter]', EASE, isOpen ? 'translate-y-0 blur-none' : '-translate-y-1.5 blur-[2px]')}>
                    {mine.length === 0 ? <li className="text-muted-foreground/70 py-1.5 ps-4 text-sm">{t('noneInShop')}</li> : null}
                    {mine.map((row) => (
                      <li key={row.amanat.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(row)}
                          className="text-muted-foreground before:border-foreground/15 hover:bg-foreground/6 hover:text-foreground relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm ps-4 pe-1.5 text-start text-sm transition-colors before:absolute before:start-0 before:top-1/2 before:w-2.5 before:border-t"
                        >
                          <span className="min-w-0 flex-1 truncate">{row.clientName}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/* ── The page ────────────────────────────────────────────────────────── */

export function AmanatNotes() {
  const t = useTranslations('amanatNotes');
  const tAmanat = useTranslations('amanat');
  const locale = useLocale();
  const dayLabel = useDayLabel();
  const { workspace, can } = useWorkspace();
  const scope = useShopScope();
  // The shop picked in the sidebar's switcher, or every shop.
  const shops = inScope(useMyWorkspaces().data ?? [], scope).map((m) => m.workspace);
  const shopIds = shops.map((s) => s.id);
  const lists = useAmanatOfShops(shopIds);
  const trashLists = useTrashedAmanat(shopIds);
  const highlight = useHighlightAmanat();
  const message = useMessage();
  const side = useSyncExternalStore(subscribeSide, readSide, () => true);
  const [tab, setTab] = useState<Tab>('all');
  const [place, setPlace] = useState<Id | null>(null);
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [wheel, setWheel] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AmanatRow | null>(null);
  const [openId, setOpenId] = useState<Id | null>(null);
  const recent = useSyncExternalStore(subscribeRecent, recentSnapshot, () => NONE);
  const today = businessDate(workspace.timeZone);
  const shopOf = (id: Id) => shops.find((s) => s.id === id);

  const loading = shops.length === 0 || lists.some((q) => q.isPending);
  const rows = lists.flatMap((q) => q.data ?? []).sort((a, b) => b.amanat.createdAt.localeCompare(a.amanat.createdAt));
  const trashed = trashLists.flatMap((q) => q.data ?? []).sort((a, b) => (b.amanat.deletedAt ?? '').localeCompare(a.amanat.deletedAt ?? ''));
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (row: AmanatRow) => words.every((word) => `${row.clientName} ${row.amanat.note ?? ''} ${row.account.name} ${row.amanat.amount / 100}`.toLowerCase().includes(word));
  const here = rows.filter((row) => (place === null || row.amanat.workspaceId === place) && (!day || row.amanat.date === day) && matches(row));
  const highlighted = here.filter((row) => row.amanat.highlighted);
  const recentRows = here.filter((row) => recent[row.amanat.id]).sort((a, b) => recent[b.amanat.id]! - recent[a.amanat.id]!);
  const opened = [...rows, ...trashed].find((row) => row.amanat.id === openId) ?? null;

  const counts: Record<Tab, number> = { all: here.length, shops: here.length, recent: recentRows.length, highlighted: highlighted.length, trash: trashed.length };
  const open = (row: AmanatRow) => {
    rememberOpened(row.amanat.id);
    setOpenId(row.amanat.id);
  };
  const toggleHighlight = (row: AmanatRow) => highlight.mutateAsync({ shopId: row.amanat.workspaceId, id: row.amanat.id, on: !row.amanat.highlighted }).catch((error: unknown) => gooeyToast.error(message(errorKey(error))));
  const card = (row: AmanatRow) => <AmanatCard key={row.amanat.id} row={row} shop={shopOf(row.amanat.workspaceId)} day={dayLabel(row.amanat.date, today)} onOpen={() => open(row)} onHighlight={() => toggleHighlight(row)} />;
  const dayChip = day ? new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`)) : null;
  const canAdd = can('record');

  /** Nothing to show: the piggy bank, centred, and Add amanat under it (where adding fits). */
  const empty = (text: string, withAdd: boolean) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/illustrations/saving-piggy.svg" alt="" width={200} height={200} className="size-44 dark:hue-rotate-180 dark:invert" />
      <p className="text-muted-foreground max-w-72 text-sm">{text}</p>
      {withAdd && canAdd ? (
        <button type="button" onClick={() => setAdding(true)} className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-opacity hover:opacity-90">
          <PlusIcon className="size-4" />
          {tAmanat('addFull')}
        </button>
      ) : null}
    </div>
  );

  const shown = tab === 'highlighted' ? highlighted : tab === 'recent' ? recentRows : here;
  const body = loading ? (
    <div className="grid grid-cols-1 gap-4 p-2 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-card h-64 animate-pulse rounded-lg" />
      ))}
    </div>
  ) : tab === 'trash' ? (
    <TrashView rows={trashed} shopOf={shopOf} today={today} />
  ) : tab === 'shops' ? (
    here.length === 0 ? (
      empty(words.length || day ? t('noMatch') : t('emptyAll'), !words.length && !day)
    ) : (
      <div className="flex flex-col gap-6 pb-8">
        {shops
          .filter((shop) => place === null || shop.id === place)
          .map((shop) => {
            const mine = here.filter((row) => row.amanat.workspaceId === shop.id);
            if (mine.length === 0) return null;
            return (
              <section key={shop.id} className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 px-2 text-sm font-semibold">
                  <span className={cn('size-3.5 rounded-sm', colourFor(shop.id))} />
                  {shop.name}
                  <span className={COUNT}>{mine.length}</span>
                </h2>
                <CardsGrid rows={mine.length}>{mine.map(card)}</CardsGrid>
              </section>
            );
          })}
      </div>
    )
  ) : shown.length === 0 ? (
    empty(
      words.length || day ? t('noMatch') : tab === 'highlighted' ? t('emptyHighlighted') : tab === 'recent' ? t('emptyRecent') : t('emptyAll'),
      tab === 'all' && !words.length && !day,
    )
  ) : (
    <div className="pb-8">
      <CardsGrid rows={shown.length}>{shown.map(card)}</CardsGrid>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* The left section: slides shut and open like an accordion. */}
      <div inert={!side} className={cn('flex shrink-0 overflow-hidden transition-[width,opacity] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] max-md:hidden', side ? 'w-[17rem] opacity-100' : 'w-0 opacity-0')}>
        <SidePanel rows={rows} shops={shops} place={place} onPlace={setPlace} query={query} onQuery={setQuery} onClose={() => setSide(false)} onOpen={open} />
      </div>

      <section className="flex min-w-0 flex-1 flex-col">
        {/* The tabs, filling the bar's height with their underline on its edge; the calendar and New at the end. */}
        <div className="border-border flex h-11 shrink-0 items-center gap-5 overflow-x-auto border-b px-5 [scrollbar-width:none] max-md:gap-4 max-md:px-3">
          {side ? null : (
            <button type="button" onClick={() => setSide(true)} aria-label={t('openSide')} className={cn(SIDE_ICON, 'max-md:hidden')}>
              <PanelLeftIcon className="size-4 rtl:-scale-x-100" />
            </button>
          )}
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                '-mb-px flex h-full shrink-0 cursor-pointer items-center gap-1.5 border-b-2 text-sm transition-colors',
                tab === id ? 'border-foreground text-foreground font-medium' : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {t(`tabs.${id}`)}
              {!loading ? <span className={COUNT}>{counts[id]}</span> : null}
            </button>
          ))}
          <span className="ms-auto flex shrink-0 items-center gap-2">
            {dayChip ? (
              <span className={cn(BOX, 'gap-1.5 border-[#2f80ed]/40 bg-[#2f80ed]/10 pe-1 text-[#2f80ed]')}>
                {t('heldOn', { day: dayChip })}
                <button type="button" onClick={() => setDay(null)} aria-label={t('clearDay')} className="flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors hover:bg-[#2f80ed]/15">
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setWheel(true)}
              aria-label={day ? t('changeDay') : t('pickDay')}
              title={day ? t('changeDay') : t('pickDay')}
              className={cn('text-muted-foreground hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded-sm transition-colors', day && 'text-[#2f80ed]')}
            >
              <CalendarMarkGlyph className="size-4" />
            </button>
          </span>
          {canAdd ? (
            <button type="button" onClick={() => setAdding(true)} className="bg-foreground text-background flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-opacity hover:opacity-90">
              <PlusIcon className="size-4" />
              {t('new')}
            </button>
          ) : null}
        </div>

        <div className="scrollbar-pill flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-3">{body}</div>
      </section>

      <DateWheel open={wheel} onOpenChange={setWheel} value={day ?? today} latest={today} firstYear={Number(today.slice(0, 4)) - 2} onPick={setDay} onToday={() => setDay(today)} />
      <AmanatDialog
        open={adding || editing !== null}
        editing={editing}
        // The shop picked on the left, if one is; else the main shop.
        shop={place}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
      />
      <AmanatDetails
        row={opened}
        shop={opened ? shopOf(opened.amanat.workspaceId) : undefined}
        today={today}
        onClose={() => setOpenId(null)}
        onEdit={(row) => {
          setOpenId(null);
          setEditing(row);
        }}
      />
    </div>
  );
}
