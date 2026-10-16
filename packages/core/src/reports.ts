import type { CurrencyCode } from './currencies';
import { addDays, type BusinessDate } from './dates';
import { chargesOf, chargesTotal, netOf } from './deals';
import type { Account, DailyClosing, Exchange, Expense, ExpenseCategory, Id, Timestamp } from './entities';
import { closingDifferences } from './closing';
import { addTo, type Money } from './money';
import type { RateBoard } from './rates';

// Reports (Build Plan v4, 7.5): for a run of days, each day's Sallam profit,
// exchange profit, expenses and net, whether it was closed (who, and how far
// the count was off), and the whole run added up. Profit is read off each
// row exactly as on the Profit page, so the two always agree.

export interface ReportDay {
  date: BusinessDate;
  /** Profit from Sallam rows (dollars for dollars), per currency. */
  sallam: Money[];
  /** Profit from exchange rows (dollars ↔ shillings), per currency. */
  exchange: Money[];
  expenses: Money[];
  /** Sallam + exchange − expenses, per currency. */
  net: Money[];
  /** Net as one figure in the base currency at that day's rate; null without it. */
  netInBase: Money | null;
  /** How many Sallam and exchange rows. */
  rows: number;
  closed: { closedBy: Id; closedAt: Timestamp; differences: Money[] } | null;
}

export interface Report {
  from: BusinessDate;
  to: BusinessDate;
  /** Newest first. */
  days: ReportDay[];
  sallam: Money[];
  exchange: Money[];
  expenses: Money[];
  net: Money[];
  rows: number;
  /** Expenses per category, biggest list first. */
  expensesByCategory: { category: ExpenseCategory; total: Money[] }[];
  /** Every closing's difference added up, per currency. */
  differences: Money[];
  closedDays: number;
}

export interface ReportInput {
  from: BusinessDate;
  to: BusinessDate;
  exchanges: readonly Exchange[];
  expenses: readonly Expense[];
  closings: readonly DailyClosing[];
  accounts: readonly Account[];
  /** Each day's rate board (rows saved before rates were kept on them use it). */
  boardFor: (date: BusinessDate) => RateBoard;
}

const usdFirst = (list: Money[]) => list.sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : a.currency.localeCompare(b.currency)));

function sum(lists: readonly Money[][]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const list of lists) for (const money of list) addTo(totals, money);
  return usdFirst([...totals].map(([currency, amount]) => ({ amount, currency })));
}

/** The days from `from` to `to`, both included (at most a year and a bit). */
export function daysBetween(from: BusinessDate, to: BusinessDate): BusinessDate[] {
  const days: BusinessDate[] = [];
  for (let day = from; day <= to && days.length < 400; day = addDays(day, 1)) days.push(day);
  return days;
}

export function report(input: ReportInput): Report {
  const live = <T extends { deletedAt: string | null; date: BusinessDate }>(rows: readonly T[]) =>
    rows.filter((row) => row.deletedAt === null && row.date >= input.from && row.date <= input.to);
  const exchanges = live(input.exchanges);
  const expenses = live(input.expenses);

  const days = daysBetween(input.from, input.to)
    .reverse()
    .map((date): ReportDay => {
      const board = input.boardFor(date);
      const deals = exchanges.filter((x) => x.date === date);
      const sallam = chargesOf(
        deals.filter((x) => x.currencyIn === x.currencyOut),
        board,
      );
      const exchange = chargesOf(
        deals.filter((x) => x.currencyIn !== x.currencyOut),
        board,
      );
      const spent = sum([expenses.filter((x) => x.date === date).map((x) => ({ amount: x.amount, currency: x.currency }))]);
      const net = netOf(sum([sallam, exchange]), spent);
      const closings = input.closings.filter((c) => c.date === date);
      const first = closings[0];
      return {
        date,
        sallam,
        exchange,
        expenses: spent,
        net,
        netInBase: net.length === 0 ? { amount: 0, currency: board.base } : chargesTotal(net, board),
        rows: deals.length,
        closed: first ? { closedBy: first.closedBy, closedAt: first.closedAt, differences: closingDifferences(closings, input.accounts) } : null,
      };
    });

  const byCategory = new Map<ExpenseCategory, Map<CurrencyCode, number>>();
  for (const expense of expenses) {
    const totals = byCategory.get(expense.category) ?? new Map<CurrencyCode, number>();
    addTo(totals, { amount: expense.amount, currency: expense.currency });
    byCategory.set(expense.category, totals);
  }

  return {
    from: input.from,
    to: input.to,
    days,
    sallam: sum(days.map((d) => d.sallam)),
    exchange: sum(days.map((d) => d.exchange)),
    expenses: sum(days.map((d) => d.expenses)),
    net: sum(days.map((d) => d.net)),
    rows: days.reduce((total, d) => total + d.rows, 0),
    expensesByCategory: [...byCategory]
      .map(([category, totals]) => ({ category, total: usdFirst([...totals].map(([currency, amount]) => ({ amount, currency }))) }))
      .sort((a, b) => b.total.reduce((s, m) => s + m.amount, 0) - a.total.reduce((s, m) => s + m.amount, 0)),
    differences: sum(days.map((d) => d.closed?.differences ?? [])),
    closedDays: days.filter((d) => d.closed).length,
  };
}

/**
 * A report as CSV, one line per day, for a spreadsheet. Amounts are in
 * major units ("160.00"); `format` turns minor units into that text.
 */
export function reportCsv(data: Report, format: (money: Money) => string, headers: readonly string[]): string {
  const cell = (list: Money[]) => list.map(format).join(' | ');
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = data.days
    .slice()
    .reverse()
    .map((day) => [day.date, cell(day.sallam), cell(day.exchange), cell(day.expenses), cell(day.net), String(day.rows), day.closed ? cell(day.closed.differences) || '0' : ''].map(quote).join(','));
  return [headers.map(quote).join(','), ...lines].join('\n');
}
