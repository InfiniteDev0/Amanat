import { describe, expect, it } from 'vitest';

import { closingDifference, closingDifferences, closingLines, countsMissingNotes, totalInShillings } from './closing';
import type { Account, Amanat, DailyClosing, Entry, Exchange, Expense } from './entities';
import { isLastOwner } from './permissions';
import { daysBetween, report } from './reports';
import type { RateBoard } from './rates';

const now = '2026-10-11T09:00:00.000Z';

function account(id: string, currency: Account['currency'], type: Account['type'], openingBalance: number): Account {
  return { id, workspaceId: 'w1', name: id, type, currency, provider: null, openingBalance, minimumBalance: null, archived: false, createdAt: now };
}

const usd = account('cash-usd', 'USD', 'cash', 2_000_000);
const kes = account('cash-kes', 'KES', 'cash', 55_000_000);

function entry(id: string, accountId: string, date: string, amount: number, currency: Entry['currency']): Entry {
  return { id, workspaceId: 'w1', accountId, date, amount, currency, sourceType: 'exchange', sourceId: id, createdBy: 'u1', createdAt: now, deletedAt: null };
}

function amanat(id: string, date: string, type: Amanat['type'], amount: number): Amanat {
  return { id, workspaceId: 'w1', createdBy: 'u1', createdAt: now, deletedAt: null, clientId: null, clientName: 'Abdi', date, type, amount, currency: 'USD', accountId: 'cash-usd', note: null };
}

const board: RateBoard = { base: 'USD', rates: { KES: { buy: '129.61', sell: '129.61' } } };

describe('closingLines', () => {
  const entries = [entry('e1', 'cash-usd', '2026-10-10', 10_000, 'USD'), entry('e2', 'cash-usd', '2026-10-11', -5_000, 'USD'), entry('e3', 'cash-usd', '2026-10-12', 99_999, 'USD')];
  const amanats = [amanat('a1', '2026-10-11', 'deposit', 50_000), amanat('a2', '2026-10-12', 'deposit', 7_000)];

  it('expects the opening plus everything up to and including the day, not after', () => {
    const [line] = closingLines([usd], entries, amanats, '2026-10-11');
    expect(line?.expected).toBe(2_000_000 + 10_000 - 5_000);
  });

  it("shows the amanat held in each account and the shop's own money apart", () => {
    const [line] = closingLines([usd], entries, amanats, '2026-10-11');
    expect(line?.amanatHeld).toBe(50_000);
    expect(line?.own).toBe(2_005_000 - 50_000);
  });

  it('leaves archived accounts out', () => {
    expect(closingLines([{ ...usd, archived: true }, kes], [], [], '2026-10-11').map((l) => l.account.id)).toEqual(['cash-kes']);
  });
});

describe('closing counts', () => {
  const lines = closingLines([usd, kes], [], [], '2026-10-11');

  it('difference is counted − expected: 50 $ short is −50', () => {
    expect(closingDifference(2_000_000, 1_995_000)).toBe(-5_000);
  });

  it('needs a note only where the count is off', () => {
    const missing = countsMissingNotes(lines, [
      { accountId: 'cash-usd', counted: 1_995_000, note: null },
      { accountId: 'cash-kes', counted: 55_000_000, note: null },
    ]);
    expect(missing).toEqual(['cash-usd']);
    expect(countsMissingNotes(lines, [{ accountId: 'cash-usd', counted: 1_995_000, note: 'Gave change twice' }])).toEqual([]);
  });

  it('adds dollars and shillings up in KSh at the day rate', () => {
    expect(totalInShillings([{ amount: 10_000, currency: 'USD' }, { amount: 5_000, currency: 'KES' }], board)).toEqual({ amount: 1_296_100 + 5_000, currency: 'KES' });
    expect(totalInShillings([{ amount: 10_000, currency: 'USD' }], { base: 'USD', rates: {} })).toBeNull();
  });

  it("adds a closed day's differences up per currency, USD first", () => {
    const closing = (accountId: string, difference: number): DailyClosing => ({ id: accountId, workspaceId: 'w1', date: '2026-10-11', accountId, expected: 0, counted: difference, difference, note: 'x', closedBy: 'u1', closedAt: now });
    expect(closingDifferences([closing('cash-kes', 20_000), closing('cash-usd', -5_000)], [usd, kes])).toEqual([
      { amount: -5_000, currency: 'USD' },
      { amount: 20_000, currency: 'KES' },
    ]);
  });
});

describe('report', () => {
  const recorded = { workspaceId: 'w1', createdBy: 'u1', createdAt: now, deletedAt: null, clientId: null, rate: '1', note: null, kind: null, customerRate: null, percent: null, customer: null, highlight: null };
  // Sallam sold 20,000 at 0.8% (+160 $) on the 10th; exchange bought 100 $ at 127 against 129.61 (+261 KSh) on the 11th.
  const sallam: Exchange = { ...recorded, id: 's1', date: '2026-10-10', currencyIn: 'USD', amountIn: 2_016_000, accountIn: 'sallam', currencyOut: 'USD', amountOut: 2_000_000, accountOut: 'cash-usd' };
  const bought: Exchange = { ...recorded, id: 'x1', date: '2026-10-11', currencyIn: 'USD', amountIn: 10_000, accountIn: 'cash-usd', currencyOut: 'KES', amountOut: 1_270_000, accountOut: 'cash-kes', todayRate: '129.61' };
  const lunch: Expense = { id: 'ex1', workspaceId: 'w1', createdBy: 'u1', createdAt: now, deletedAt: null, date: '2026-10-11', category: 'food', amount: 60_000, currency: 'KES', accountId: 'cash-kes', note: null };
  const closed: DailyClosing = { id: 'c1', workspaceId: 'w1', date: '2026-10-10', accountId: 'cash-usd', expected: 0, counted: -5_000, difference: -5_000, note: 'short', closedBy: 'u1', closedAt: now };
  const data = report({ from: '2026-10-09', to: '2026-10-11', exchanges: [sallam, bought], expenses: [lunch], closings: [closed], accounts: [usd, kes], boardFor: () => board });

  it('has every day, newest first, even the empty ones', () => {
    expect(data.days.map((d) => d.date)).toEqual(['2026-10-11', '2026-10-10', '2026-10-09']);
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });

  it("splits each day's profit into Sallam and exchange, minus expenses", () => {
    const [eleventh, tenth] = data.days;
    expect(tenth?.sallam).toEqual([{ amount: 16_000, currency: 'USD' }]);
    expect(eleventh?.exchange).toEqual([{ amount: 26_100, currency: 'KES' }]);
    expect(eleventh?.net).toEqual([{ amount: 26_100 - 60_000, currency: 'KES' }]);
  });

  it('adds the run up, with closings and expenses per category', () => {
    expect(data.net).toEqual([
      { amount: 16_000, currency: 'USD' },
      { amount: -33_900, currency: 'KES' },
    ]);
    expect(data.rows).toBe(2);
    expect(data.closedDays).toBe(1);
    expect(data.differences).toEqual([{ amount: -5_000, currency: 'USD' }]);
    expect(data.expensesByCategory).toEqual([{ category: 'food', total: [{ amount: 60_000, currency: 'KES' }] }]);
  });
});

describe('isLastOwner', () => {
  it('keeps one Owner in every shop', () => {
    expect(isLastOwner([{ id: 'm1', role: 'owner' }, { id: 'm2', role: 'editor' }], 'm1')).toBe(true);
    expect(isLastOwner([{ id: 'm1', role: 'owner' }, { id: 'm2', role: 'owner' }], 'm1')).toBe(false);
    expect(isLastOwner([{ id: 'm1', role: 'owner' }, { id: 'm2', role: 'editor' }], 'm2')).toBe(false);
  });
});
