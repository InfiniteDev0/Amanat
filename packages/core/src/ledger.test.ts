import { describe, expect, it } from 'vitest';

import type { Account, Debt, DebtPayment, Entry, Exchange, Transfer, Workspace } from './entities';
import { accountBalances, debtState, entriesFor, type EntryDraft, LedgerError } from './ledger';
import { can, canEditEntry } from './permissions';
import { daySummary } from './summary';

const now = '2026-10-07T09:00:00.000Z';
const day = '2026-10-07';

function account(id: string, currency: Account['currency'], openingBalance = 0, workspaceId = 'w1'): Account {
  return {
    id,
    workspaceId,
    name: id,
    type: 'cash',
    currency,
    provider: null,
    openingBalance,
    minimumBalance: null,
    archived: false,
    createdAt: now,
  };
}

const accounts = [account('cash-usd', 'USD', 100000), account('cash-kes', 'KES', 5000000), account('other-shop', 'USD', 0, 'w2')];
const lookup = (id: string) => accounts.find((a) => a.id === id);
const recorded = { workspaceId: 'w1', createdBy: 'u1', createdAt: now, deletedAt: null, date: day };

const exchange: Exchange = {
  ...recorded,
  id: 'x1',
  currencyIn: 'USD',
  amountIn: 10000,
  accountIn: 'cash-usd',
  currencyOut: 'KES',
  amountOut: 1290000,
  accountOut: 'cash-kes',
  rate: '129',
  clientId: null,
  note: null,
};

function toEntries(drafts: EntryDraft[]): Entry[] {
  return drafts.map((draft, index) => ({ ...draft, id: `e${index}`, createdBy: 'u1', createdAt: now, deletedAt: null }));
}

describe('entriesFor', () => {
  it('an exchange is money in on one account and out of another', () => {
    const drafts = entriesFor({ type: 'exchange', record: exchange }, lookup);
    expect(drafts.map((d) => [d.accountId, d.amount])).toEqual([
      ['cash-usd', 10000],
      ['cash-kes', -1290000],
    ]);
  });

  it('refuses an amount in the wrong currency for its account', () => {
    const wrong = { ...exchange, accountIn: 'cash-kes', accountOut: 'cash-usd' };
    expect(() => entriesFor({ type: 'exchange', record: wrong }, lookup)).toThrow(LedgerError);
  });

  it("refuses another shop's account", () => {
    const wrong = { ...exchange, accountIn: 'other-shop' };
    expect(() => entriesFor({ type: 'exchange', record: wrong }, lookup)).toThrow(/another shop/);
  });

  it('a transfer to another shop lands in that shop, fee comes out of the sender', () => {
    const transfer: Transfer = {
      ...recorded,
      id: 't1',
      fromAccountId: 'cash-usd',
      toAccountId: 'other-shop',
      toWorkspaceId: 'w2',
      amountOut: 50000,
      amountIn: 50000,
      fee: 200,
      note: null,
    };
    const drafts = entriesFor({ type: 'transfer', record: transfer }, lookup);
    expect(drafts.map((d) => [d.workspaceId, d.accountId, d.amount])).toEqual([
      ['w1', 'cash-usd', -50000],
      ['w2', 'other-shop', 50000],
      ['w1', 'cash-usd', -200],
    ]);
  });

  it('a debt repayment follows the direction of the debt', () => {
    const debt: Debt = { ...recorded, id: 'd1', clientId: 'c1', direction: 'they_owe_us', amount: 30000, currency: 'USD', dueDate: null, note: null };
    const payment: DebtPayment = { ...recorded, id: 'p1', debtId: 'd1', amount: 10000, accountId: 'cash-usd' };
    expect(entriesFor({ type: 'debt_payment', record: payment, debt }, lookup)[0]?.amount).toBe(10000);
    const ours = { ...debt, direction: 'we_owe_them' as const };
    expect(entriesFor({ type: 'debt_payment', record: payment, debt: ours }, lookup)[0]?.amount).toBe(-10000);
    expect(debtState(debt, [payment])).toEqual({ paid: 10000, remaining: 20000, status: 'partly_paid' });
  });
});

describe('balances', () => {
  it('balance = opening + live entries; deleted entries do not count', () => {
    const entries = toEntries(entriesFor({ type: 'exchange', record: exchange }, lookup));
    entries.push({ ...entries[0]!, id: 'deleted', deletedAt: now });
    const balances = accountBalances(accounts, entries);
    expect(balances.get('cash-usd')).toBe(110000);
    expect(balances.get('cash-kes')).toBe(3710000);
  });
});

describe('daySummary', () => {
  it('adds up the day and values profit at mid rates', () => {
    const workspace: Workspace = {
      id: 'w1',
      name: 'Eastleigh',
      location: '',
      baseCurrency: 'USD',
      currencies: ['USD', 'KES'],
      timeZone: 'Africa/Nairobi',
      closingTime: '21:00',
      largeTransactionLimit: 500000,
      ownerId: 'u1',
      status: 'active',
      createdAt: now,
    };
    const rates = [{ id: 'r1', workspaceId: 'w1', currency: 'KES' as const, date: day, buy: '129', sell: '130', setBy: 'u1', setAt: now }];
    const summary = daySummary({
      workspace,
      date: day,
      accounts: accounts.filter((a) => a.workspaceId === 'w1'),
      entries: toEntries(entriesFor({ type: 'exchange', record: exchange }, lookup)),
      rates,
      exchanges: [exchange],
      expenses: [],
      amanats: [],
      debts: [],
      debtPayments: [],
    });
    expect(summary.missingRates).toEqual([]);
    expect(summary.exchangedIn).toEqual([{ amount: 10000, currency: 'USD' }]);
    // 12,900 KES at mid 129.5 = 99.61 USD; 100 − 99.61 = 0.39 USD
    expect(summary.profit).toBe(39);
    expect(summary.accounts.find((p) => p.account.id === 'cash-kes')).toMatchObject({ balance: 3710000, todayOut: 1290000 });
  });
});

describe('permissions', () => {
  it('follows the spec table', () => {
    expect(can('viewer', 'record')).toBe(false);
    expect(can('editor', 'set_rates')).toBe(true);
    expect(can('editor', 'manage_team')).toBe(false);
    expect(can('owner', 'reopen_day')).toBe(true);
    expect(can(null, 'view')).toBe(false);
  });

  it('editors edit only their own entries from today', () => {
    expect(canEditEntry('editor', { createdBy: 'u1', dayClosed: false }, 'u1')).toBe(true);
    expect(canEditEntry('editor', { createdBy: 'u2', dayClosed: false }, 'u1')).toBe(false);
    expect(canEditEntry('editor', { createdBy: 'u1', dayClosed: true }, 'u1')).toBe(false);
    expect(canEditEntry('owner', { createdBy: 'u2', dayClosed: true }, 'u1')).toBe(true);
  });
});
