'use client';

import { addDays, type BookRow, businessDate, type CurrencyCode, type DealRow, dealSection, fromMinor, type Money, monthStart } from '@sarrif/core';
import { useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';

import { useShortMoney } from '@/features/profit/money-text';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

// The calculator's searches, as Barista's: what a calculation's fields ask
// for (money in, money out, profit, expenses or amanat, over a range,
// narrowed to an account, a customer, an expense kind, a currency and an
// amount), worked out from the shop's records through the same queries the
// other pages use, so they're shared.

export const KINDS = ['in', 'out', 'profit', 'expenses', 'amanat'] as const;
export type SearchKind = (typeof KINDS)[number];

export const RANGES = ['today', 'thisWeek', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'custom'] as const;
export type SearchRange = (typeof RANGES)[number];

export type AmountMode = '' | 'exact' | 'range' | 'highest' | 'lowest';

/** What a search asks for: a calculation's fields. */
export interface SearchParams {
  /** The shop whose records it searches: the main shop to start with. */
  shopId: string;
  kind: SearchKind;
  range: SearchRange;
  from: string;
  to: string;
  accountId: string;
  /** Words in the customer's name or the note. */
  customer: string;
  /** Expenses: one kind (rent, salary…). */
  category: string;
  currency: string;
  amountMode: AmountMode;
  /** Exactly this, or between: the lowest it may be (in the money's own units, 20,000 not 2,000,000). */
  amount: string;
  /** Between: the highest it may be. */
  amountMax: string;
}

export interface ResultColumn {
  label: string;
  /** Its share of a PDF's width. */
  width: number;
  align?: 'start' | 'end';
}

/** What a search found: the columns, one row of text per find, and what they add up to. */
export interface SearchResult {
  columns: ResultColumn[];
  rows: string[][];
  /** Each row's own figure, for the totals of some of them. */
  values: Money[];
  total: Money[];
  totalLabel: string;
  /** The days in words: "1 – 22 Nov 2026". */
  span: string;
}

/** The first and last day a range covers, never past today. */
export function rangeDays(range: SearchRange, today: string, from: string, to: string): { from: string; to: string } {
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'thisWeek': {
      // Monday to today.
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      return { from: addDays(today, -((weekday + 6) % 7)), to: today };
    }
    case 'thisMonth':
      return { from: monthStart(today), to: today };
    case 'lastMonth': {
      const end = addDays(monthStart(today), -1);
      return { from: monthStart(end), to: end };
    }
    case 'last3Months':
      return { from: monthStart(addDays(monthStart(addDays(monthStart(today), -1)), -1)), to: today };
    case 'thisYear':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'custom': {
      const a = from && from <= today ? from : today;
      const b = to && to <= today ? to : today;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
}

/** A figure typed in the money's own units, as a number; nothing is null. */
const typed = (text: string) => (text.trim() === '' || !Number.isFinite(Number(text)) ? null : Number(text));
const major = (money: Money) => Number(fromMinor(Math.abs(money.amount), money.currency).toString());

/** Narrows finds by their amount: exactly, between, or only the highest or lowest (ties all kept). */
function byAmount<T>(items: T[], value: (item: T) => number, params: SearchParams): T[] {
  switch (params.amountMode) {
    case 'exact': {
      const exactly = typed(params.amount);
      return exactly === null ? items : items.filter((item) => value(item) === exactly);
    }
    case 'range': {
      const low = typed(params.amount);
      const high = typed(params.amountMax);
      return items.filter((item) => (low === null || value(item) >= low) && (high === null || value(item) <= high));
    }
    case 'highest':
    case 'lowest': {
      if (!items.length) return items;
      const values = items.map(value);
      const edge = params.amountMode === 'highest' ? Math.max(...values) : Math.min(...values);
      return items.filter((item) => value(item) === edge);
    }
    default:
      return items;
  }
}

/** Per currency, dollars first. */
export function sumMoney(values: Money[]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const money of values) totals.set(money.currency, (totals.get(money.currency) ?? 0) + money.amount);
  return [...totals].map(([currency, amount]) => ({ amount, currency })).sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : a.currency.localeCompare(b.currency)));
}

/** The days from `from` to `to`, both in. */
function daysOf(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

/** The range in words: "Sun 22 Nov", "16 – 22 Nov 2026". */
export function useSpan() {
  const locale = useLocale();
  return (from: string, to: string) => {
    const at = (date: string) => new Date(`${date}T12:00:00Z`);
    if (from === to) return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(at(from));
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).formatRange(at(from), at(to));
  };
}

/** Runs a search: the records for its days, narrowed as it asks, as rows of text with their figures. */
export function useRunSearch() {
  const t = useTranslations('calculator');
  const tExpenses = useTranslations('expenses');
  const locale = useLocale();
  const qc = useQueryClient();
  const short = useShortMoney();
  const span = useSpan();
  const { workspace: here } = useWorkspace();
  const shops = useMyWorkspaces().data ?? [];

  const day = (date: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const words = (text: string) => text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (haystack: string, query: string) => words(query).every((word) => haystack.toLowerCase().includes(word));

  return async (params: SearchParams): Promise<SearchResult> => {
    // The shop it asks about (the one on screen if it's gone).
    const workspace = shops.find((m) => m.workspace.id === params.shopId)?.workspace ?? here;
    const today = businessDate(workspace.timeZone);
    const { from, to } = rangeDays(params.range, today, params.from, params.to);
    const amountColumn = (label: string): ResultColumn => ({ label, width: 1.4, align: 'end' });

    if (params.kind === 'profit') {
      // Each day's deals (cached per day, as the other pages keep them).
      const lists = await Promise.all(
        daysOf(from, to).map((date) =>
          qc.fetchQuery({ queryKey: queryKeys.deals(workspace.id, date === today ? undefined : date), queryFn: () => api.deals.list(workspace.id, date === today ? undefined : date) }),
        ),
      );
      let found = lists.flat().filter((row): row is DealRow & { profit: Money } => row.profit !== null);
      found = found.filter(
        ({ deal, profit }) =>
          (!params.accountId || deal.accountIn === params.accountId || deal.accountOut === params.accountId) &&
          (!params.customer || matches(`${deal.customer ?? ''} ${deal.note ?? ''}`, params.customer)) &&
          (!params.currency || profit.currency === params.currency),
      );
      found = byAmount(found, (row) => major(row.profit), params).sort((a, b) => b.deal.date.localeCompare(a.deal.date) || b.deal.createdAt.localeCompare(a.deal.createdAt));
      return {
        columns: [
          { label: t('columns.date'), width: 1.1 },
          { label: t('columns.deal'), width: 2.6 },
          { label: t('columns.kind'), width: 1 },
          { label: t('columns.customer'), width: 1.4 },
          amountColumn(t('columns.profit')),
        ],
        rows: found.map(({ deal, profit }) => [
          day(deal.date),
          `${t('dealIn', { amount: short({ amount: deal.amountIn, currency: deal.currencyIn }) })} · ${t('dealOut', { amount: short({ amount: deal.amountOut, currency: deal.currencyOut }) })}`,
          t(`recordKinds.${dealSection(deal)}`),
          deal.customer ?? '—',
          short(profit, true),
        ]),
        values: found.map((row) => row.profit),
        total: sumMoney(found.map((row) => row.profit)),
        totalLabel: t('totalProfit'),
        span: span(from, to),
      };
    }

    const filter = { from, to };
    const book = await qc.fetchQuery({ queryKey: queryKeys.book(workspace.id, filter), queryFn: () => api.book.list(workspace.id, filter) });
    // Each find and its figure: what came in, what went out, or the expense or amanat itself.
    const pick = (row: BookRow): Money | null => {
      if (params.kind === 'in') return row.in;
      if (params.kind === 'out') return row.out ? { ...row.out, amount: -row.out.amount } : null;
      if (params.kind === 'expenses') return row.type === 'expense' && row.out ? { ...row.out, amount: -row.out.amount } : null;
      if (row.type !== 'amanat') return null;
      return row.in ?? (row.out ? { ...row.out, amount: -row.out.amount } : null);
    };
    let found = book.flatMap((row) => {
      const value = pick(row);
      return value ? [{ row, value }] : [];
    });
    found = found.filter(
      ({ row, value }) =>
        (!params.accountId || row.accounts.some((account) => account.id === params.accountId)) &&
        (!params.customer || matches(`${row.client?.name ?? ''} ${row.note ?? ''}`, params.customer)) &&
        (!params.category || row.detail === params.category) &&
        (!params.currency || value.currency === params.currency),
    );
    found = byAmount(found, ({ value }) => major(value), params).sort((a, b) => b.row.date.localeCompare(a.row.date) || b.row.createdAt.localeCompare(a.row.createdAt));

    const what = (row: BookRow) => {
      if (row.type === 'expense' && row.detail) return tExpenses(`categories.${row.detail as 'rent'}`);
      if (row.type === 'amanat') return t(`recordKinds.${row.in ? 'deposit' : 'withdrawal'}`);
      return t(`recordKinds.${row.type}`);
    };
    return {
      columns: [
        { label: t('columns.date'), width: 1.1 },
        { label: t('columns.kind'), width: 1.3 },
        { label: t('columns.customer'), width: 1.5 },
        { label: t('columns.account'), width: 1.6 },
        { label: t('columns.note'), width: 1.6 },
        amountColumn(t('columns.amount')),
      ],
      rows: found.map(({ row, value }) => [day(row.date), what(row), row.client?.name ?? '—', row.accounts.map((a) => a.name).join(' → ') || '—', row.note ?? '—', short(value, true)]),
      values: found.map(({ value }) => value),
      total: sumMoney(found.map(({ value }) => value)),
      totalLabel: t('total'),
      span: span(from, to),
    };
  };
}

/* ── Taking it away: PDF and CSV ─────────────────────────────────────────── */

export interface ListExport {
  title: string;
  /** The shop's name, over the title. */
  shop: string;
  /** "16 – 22 Nov 2026", or "Own calculation". */
  scope: string;
  /** "12 results | Total +1,200 $". */
  summary: string;
  fileName: string;
  columns: ResultColumn[];
  rows: string[][];
  /** The last line, in bold: "Total" under the first column, the figure under the last. */
  total: { label: string; value: string };
}

/** A list as a PDF, as Barista's: the shop, the title, what it covers, the table, the total. */
export async function exportListPdf(list: ListExport): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: list.columns.length > 4 ? 'landscape' : 'portrait' });
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(list.shop, 14, 14);
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(list.title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${list.scope}   |   ${list.summary}`, 14, 29);
  const width = doc.internal.pageSize.getWidth() - 28;
  const shares = list.columns.reduce((sum, column) => sum + column.width, 0);
  const last = list.columns.length - 1;
  autoTable(doc, {
    startY: 35,
    head: [list.columns.map((column) => column.label)],
    body: list.rows,
    foot: [list.columns.map((_, index) => (index === 0 ? list.total.label : index === last ? list.total.value : ''))],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [20, 20, 20] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: Object.fromEntries(list.columns.map((column, index) => [index, { cellWidth: (column.width / shares) * width, halign: column.align === 'end' ? 'right' : 'left' }])),
  });
  doc.save(`${list.fileName}.pdf`);
}

/** A list as a CSV a spreadsheet opens as it is (a BOM for Excel), with the total as its last line. */
export function exportListCsv(fileName: string, labels: string[], rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [labels, ...rows].map((row) => row.map(cell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** A name as a file's: "Money in – This week" → money-in-this-week. */
export const fileNameOf = (name: string, fallback: string) =>
  name
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || fallback;
