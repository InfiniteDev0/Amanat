import type { CurrencyCode } from './currencies';
import { addDays, type BusinessDate } from './dates';
import { chargesOf, chargesTotal, netOf } from './deals';
import type { Account, AccountType, DailyClosing, Entry, Exchange, Expense, ExpenseCategory, Id, SourceType, Timestamp } from './entities';
import { closingDifferences } from './closing';
import { addTo, type Money } from './money';
import type { RateBoard } from './rates';

// Reports (Build Plan v4, 7.5): for a run of days, each day's Sallam profit,
// exchange profit, expenses and net, whether it was closed (who, and how far
// the count was off), and the whole run added up. Profit is read off each
// row exactly as on the Profit page, so the two always agree.
//
// Money in and money out come from the ledger: every entry on the shop's
// accounts in the run. Money out is everything that left: exchanges paid out,
// expenses, amanat handed back, debts paid, money sent to another shop. A move
// between two of the shop's own accounts is neither (only its fee is out).

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

/** One account over the run: what it started with, what came in and went out, what it ended with. */
export interface AccountFlow {
  accountId: Id;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  start: number;
  in: number;
  out: number;
  end: number;
}

/** Money in and out of the shop by what moved it (an exchange, an expense, amanat…). */
export interface SourceFlow {
  source: SourceType;
  in: Money[];
  out: Money[];
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
  /** Everything that came into the shop, per currency. */
  moneyIn: Money[];
  /** Everything that left it, expenses included, per currency. */
  moneyOut: Money[];
  /** In and out by what moved it; only the kinds that moved something. */
  bySource: SourceFlow[];
  /** Each account over the run. */
  accountFlows: AccountFlow[];
  /** Exchanges (dollars ↔ shillings): what the shop bought and what it sold, per currency. */
  bought: Money[];
  sold: Money[];
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
  /** The shop's ledger, for money in and out and each account's run (none: only the opening amounts). */
  entries?: readonly Entry[];
}

const usdFirst = (list: Money[]) => list.sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : a.currency.localeCompare(b.currency)));

function sum(lists: readonly Money[][]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const list of lists) for (const money of list) addTo(totals, money);
  return usdFirst([...totals].map(([currency, amount]) => ({ amount, currency })));
}

const toMoney = (totals: Map<CurrencyCode, number>): Money[] => usdFirst([...totals].map(([currency, amount]) => ({ amount, currency })));

/** One movement of the shop's money: an entry, or what a move between its own accounts came to in one currency. */
interface Flow {
  sourceType: SourceType;
  amount: number;
  currency: CurrencyCode;
}

/**
 * The shop's money in and out over the run. A move between two of its own
 * accounts nets out per currency (cash to M-Pesa leaves only its fee); a move
 * to or from another shop has one leg here and counts.
 */
export function moneyFlows(entries: readonly Entry[]): { moneyIn: Money[]; moneyOut: Money[]; bySource: SourceFlow[] } {
  const flows: Flow[] = [];
  const transfers = new Map<Id, Entry[]>();
  for (const entry of entries) {
    if (entry.sourceType === 'transfer') transfers.set(entry.sourceId, [...(transfers.get(entry.sourceId) ?? []), entry]);
    else flows.push(entry);
  }
  for (const legs of transfers.values()) {
    const internal = legs.some((leg) => leg.amount > 0) && legs.some((leg) => leg.amount < 0);
    if (!internal) {
      flows.push(...legs);
      continue;
    }
    const net = new Map<CurrencyCode, number>();
    for (const leg of legs) addTo(net, { amount: leg.amount, currency: leg.currency });
    for (const [currency, amount] of net) if (amount !== 0) flows.push({ sourceType: 'transfer', amount, currency });
  }

  const moneyIn = new Map<CurrencyCode, number>();
  const moneyOut = new Map<CurrencyCode, number>();
  const bySource = new Map<SourceType, { in: Map<CurrencyCode, number>; out: Map<CurrencyCode, number> }>();
  for (const flow of flows) {
    const side = flow.amount > 0 ? 'in' : 'out';
    const money = { amount: Math.abs(flow.amount), currency: flow.currency };
    addTo(side === 'in' ? moneyIn : moneyOut, money);
    const source = bySource.get(flow.sourceType) ?? { in: new Map<CurrencyCode, number>(), out: new Map<CurrencyCode, number>() };
    addTo(source[side], money);
    bySource.set(flow.sourceType, source);
  }
  return {
    moneyIn: toMoney(moneyIn),
    moneyOut: toMoney(moneyOut),
    bySource: [...bySource].map(([source, totals]) => ({ source, in: toMoney(totals.in), out: toMoney(totals.out) })),
  };
}

/** Each account from `from` to `to`: its balance the evening before, in, out, and its balance at the end. */
export function accountFlows(accounts: readonly Account[], entries: readonly Entry[], from: BusinessDate, to: BusinessDate): AccountFlow[] {
  return accounts
    .filter((account) => !account.archived)
    .map((account) => {
      let start = account.openingBalance;
      let moneyIn = 0;
      let moneyOut = 0;
      for (const entry of entries) {
        if (entry.accountId !== account.id || entry.deletedAt !== null || entry.date > to) continue;
        if (entry.date < from) start += entry.amount;
        else if (entry.amount > 0) moneyIn += entry.amount;
        else moneyOut -= entry.amount;
      }
      return { accountId: account.id, name: account.name, type: account.type, currency: account.currency, start, in: moneyIn, out: moneyOut, end: start + moneyIn - moneyOut };
    });
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
  const entries = live(input.entries ?? []);
  const bought = new Map<CurrencyCode, number>();
  const sold = new Map<CurrencyCode, number>();
  for (const deal of exchanges) {
    if (deal.currencyIn === deal.currencyOut) continue;
    addTo(bought, { amount: deal.amountIn, currency: deal.currencyIn });
    addTo(sold, { amount: deal.amountOut, currency: deal.currencyOut });
  }

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
    ...moneyFlows(entries),
    accountFlows: accountFlows(input.accounts, input.entries ?? [], input.from, input.to),
    bought: toMoney(bought),
    sold: toMoney(sold),
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
