import {
  type Account,
  accountBalances,
  addDays,
  businessDate,
  type CurrencyCode,
  type DailyRate,
  entriesFor,
  type LedgerSource,
  type Notification,
  quoteByGive,
  type RateBoard,
  toMinor,
  type User,
  type Workspace,
} from '@sarrif/core';

import type { MockDb } from './db';

// Two demo shops with a realistic day already in them, so every screen has
// something to show from the first run. The dates follow the real calendar:
// "today" is today in Nairobi when the seed runs.
//
// Sign in as the owner with DEMO_PHONE, or as the cashier (Editor in
// Eastleigh only) with CASHIER_PHONE. The code is always DEMO_CODE.

export const DEMO_PHONE = '+254700000000';
export const CASHIER_PHONE = '+254711111111';
export const DEMO_CODE = '123456';

const TIME_ZONE = 'Africa/Nairobi';

export function seedDb(): MockDb {
  const now = Date.now();
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const today = businessDate(TIME_ZONE);
  const yesterday = addDays(today, -1);
  const usd = (value: string) => toMinor(value, 'USD');
  const kes = (value: string) => toMinor(value, 'KES');

  const db: MockDb = {
    version: 2,
    users: [],
    workspaces: [],
    members: [],
    accounts: [],
    rates: [],
    entries: [],
    clients: [],
    exchanges: [],
    expenses: [],
    transfers: [],
    amanats: [],
    debts: [],
    debtPayments: [],
    closings: [],
    activity: [],
    notifications: [],
    sessionUserId: null,
  };

  // ── People and shops ───────────────────────────────────────────────────────

  const owner: User = { id: 'user-owner', name: 'Ahmed Mohamed', phone: DEMO_PHONE, email: null, avatar: null, language: 'en', createdAt: ago(60 * 24 * 60) };
  const cashier: User = { id: 'user-cashier', name: 'Amina Hassan', phone: CASHIER_PHONE, email: null, avatar: null, language: 'so', createdAt: ago(60 * 24 * 30) };
  db.users.push(owner, cashier);

  const shop = (id: string, name: string, location: string, currencies: CurrencyCode[]): Workspace => ({
    id,
    name,
    location,
    baseCurrency: 'USD',
    currencies,
    timeZone: TIME_ZONE,
    closingTime: '21:00',
    largeTransactionLimit: usd('5000'),
    ownerId: owner.id,
    status: 'active',
    createdAt: ago(60 * 24 * 60),
  });
  const eastleigh = shop('ws-eastleigh', 'Sarrif – Eastleigh', 'Eastleigh, Nairobi', ['USD', 'KES', 'SOS']);
  const garissa = shop('ws-garissa', 'Sarrif – Garissa', 'Garissa', ['USD', 'KES']);
  db.workspaces.push(eastleigh, garissa);

  db.members.push(
    { id: 'mem-1', workspaceId: eastleigh.id, userId: owner.id, role: 'owner', joinedAt: eastleigh.createdAt },
    { id: 'mem-2', workspaceId: garissa.id, userId: owner.id, role: 'owner', joinedAt: garissa.createdAt },
    { id: 'mem-3', workspaceId: eastleigh.id, userId: cashier.id, role: 'editor', joinedAt: cashier.createdAt },
  );

  // ── Accounts ───────────────────────────────────────────────────────────────

  const account = (
    workspaceId: string,
    id: string,
    name: string,
    type: Account['type'],
    currency: CurrencyCode,
    opening: string,
    provider: string | null = null,
  ): Account => ({
    id,
    workspaceId,
    name,
    type,
    currency,
    provider,
    openingBalance: toMinor(opening, currency),
    minimumBalance: null,
    archived: false,
    createdAt: ago(60 * 24 * 60),
  });
  db.accounts.push(
    account(eastleigh.id, 'acc-e-cash-usd', 'Cash USD', 'cash', 'USD', '25000'),
    account(eastleigh.id, 'acc-e-cash-kes', 'Cash KES', 'cash', 'KES', '1500000'),
    account(eastleigh.id, 'acc-e-cash-sos', 'Cash SOS', 'cash', 'SOS', '8000000'),
    account(eastleigh.id, 'acc-e-mpesa', 'M-Pesa', 'mobile_money', 'KES', '400000', 'M-Pesa'),
    account(eastleigh.id, 'acc-e-evc', 'EVC Plus', 'mobile_money', 'USD', '5000', 'EVC Plus'),
    account(eastleigh.id, 'acc-e-bank', 'Equity Bank', 'bank', 'KES', '2000000', 'Equity Bank'),
    account(garissa.id, 'acc-g-cash-usd', 'Cash USD', 'cash', 'USD', '8000'),
    account(garissa.id, 'acc-g-cash-kes', 'Cash KES', 'cash', 'KES', '600000'),
    account(garissa.id, 'acc-g-mpesa', 'M-Pesa', 'mobile_money', 'KES', '150000', 'M-Pesa'),
  );

  // ── Rates: Eastleigh has today's; Garissa only yesterday's ─────────────────

  const rate = (workspaceId: string, date: string, currency: CurrencyCode, buy: string, sell: string): DailyRate => ({
    id: `rate-${workspaceId}-${date}-${currency}`,
    workspaceId,
    currency,
    date,
    buy,
    sell,
    setBy: owner.id,
    setAt: ago(date === today ? 300 : 60 * 24),
  });
  db.rates.push(
    rate(eastleigh.id, yesterday, 'KES', '128.80', '130.20'),
    rate(eastleigh.id, yesterday, 'SOS', '569', '574'),
    rate(eastleigh.id, today, 'KES', '129.00', '130.50'),
    rate(eastleigh.id, today, 'SOS', '570', '575'),
    rate(garissa.id, yesterday, 'KES', '129.00', '130.50'),
  );
  const board: RateBoard = { base: 'USD', rates: { KES: { buy: '129.00', sell: '130.50' }, SOS: { buy: '570', sell: '575' } } };

  // ── Clients ────────────────────────────────────────────────────────────────

  const client = (workspaceId: string, id: string, name: string, phone: string | null) => ({
    id,
    workspaceId,
    name,
    phone,
    notes: null,
    createdAt: ago(60 * 24 * 20),
  });
  db.clients.push(
    client(eastleigh.id, 'cl-ali', 'Ali Abdi', '+254722000001'),
    client(eastleigh.id, 'cl-hodan', 'Hodan Farah', '+254722000002'),
    client(eastleigh.id, 'cl-fatuma', 'Fatuma Noor', '+254722000003'),
    client(eastleigh.id, 'cl-mohamed', 'Mohamed Yusuf', null),
    client(garissa.id, 'cl-abdullahi', 'Abdullahi Omar', '+254722000010'),
  );

  // ── Records, each written through the ledger like the real backend ────────

  const add = (source: LedgerSource) => {
    const lookup = (id: string) => db.accounts.find((a) => a.id === id);
    entriesFor(source, lookup).forEach((draft, index) => {
      db.entries.push({
        ...draft,
        id: `${source.record.id}-e${index}`,
        createdBy: source.record.createdBy,
        createdAt: source.record.createdAt,
        deletedAt: null,
      });
    });
    switch (source.type) {
      case 'exchange':
        db.exchanges.push(source.record);
        break;
      case 'expense':
        db.expenses.push(source.record);
        break;
      case 'transfer':
        db.transfers.push(source.record);
        break;
      case 'amanat':
        db.amanats.push(source.record);
        break;
      case 'debt_payment':
        db.debtPayments.push(source.record);
        break;
    }
  };

  const meta = (id: string, date: string, minutesAgo: number, by: User = owner, workspaceId = eastleigh.id) => ({
    id,
    workspaceId,
    date,
    createdBy: by.id,
    createdAt: ago(minutesAgo),
    deletedAt: null,
  });

  const exchange = (
    id: string,
    minutesAgo: number,
    by: User,
    give: { amount: number; currency: CurrencyCode; account: string },
    get: { currency: CurrencyCode; account: string },
    clientId: string | null,
    date = today,
  ) => {
    const quote = quoteByGive(board, { amount: give.amount, currency: give.currency }, get.currency);
    if (!quote) throw new Error('Seed rate missing');
    add({
      type: 'exchange',
      record: {
        ...meta(id, date, minutesAgo, by),
        currencyIn: give.currency,
        amountIn: give.amount,
        accountIn: give.account,
        currencyOut: get.currency,
        amountOut: quote.amountOut.amount,
        accountOut: get.account,
        rate: quote.rate,
        clientId,
        note: null,
      },
    });
  };

  // Yesterday (closed below).
  exchange('ex-y1', 60 * 26, cashier, { amount: usd('1200'), currency: 'USD', account: 'acc-e-cash-usd' }, { currency: 'KES', account: 'acc-e-cash-kes' }, 'cl-ali', yesterday);
  exchange('ex-y2', 60 * 25, owner, { amount: kes('65250'), currency: 'KES', account: 'acc-e-mpesa' }, { currency: 'USD', account: 'acc-e-cash-usd' }, null, yesterday);
  add({ type: 'amanat', record: { ...meta('am-y1', yesterday, 60 * 27), clientId: 'cl-fatuma', type: 'deposit', amount: usd('2000'), currency: 'USD', accountId: 'acc-e-cash-usd', note: 'Safekeeping for school fees' } });

  // Today.
  exchange('ex-1', 200, cashier, { amount: usd('2500'), currency: 'USD', account: 'acc-e-cash-usd' }, { currency: 'KES', account: 'acc-e-cash-kes' }, 'cl-ali');
  exchange('ex-2', 150, owner, { amount: kes('130500'), currency: 'KES', account: 'acc-e-cash-kes' }, { currency: 'USD', account: 'acc-e-cash-usd' }, null);
  exchange('ex-3', 90, cashier, { amount: usd('4000'), currency: 'USD', account: 'acc-e-cash-usd' }, { currency: 'SOS', account: 'acc-e-cash-sos' }, 'cl-hodan');
  exchange('ex-4', 45, cashier, { amount: kes('13050'), currency: 'KES', account: 'acc-e-mpesa' }, { currency: 'USD', account: 'acc-e-evc' }, 'cl-mohamed');
  add({ type: 'expense', record: { ...meta('xp-1', today, 120, cashier), category: 'transport', amount: kes('1500'), currency: 'KES', accountId: 'acc-e-cash-kes', note: 'Boda to the bank' } });
  add({ type: 'expense', record: { ...meta('xp-2', today, 30, cashier), category: 'food', amount: kes('800'), currency: 'KES', accountId: 'acc-e-cash-kes', note: null } });
  add({ type: 'amanat', record: { ...meta('am-1', today, 100), clientId: 'cl-mohamed', type: 'deposit', amount: usd('300'), currency: 'USD', accountId: 'acc-e-cash-usd', note: null } });
  add({ type: 'amanat', record: { ...meta('am-2', today, 60), clientId: 'cl-fatuma', type: 'withdrawal', amount: usd('500'), currency: 'USD', accountId: 'acc-e-cash-usd', note: null } });
  add({ type: 'transfer', record: { ...meta('tr-1', today, 75), fromAccountId: 'acc-e-cash-kes', toAccountId: 'acc-e-bank', toWorkspaceId: null, amountOut: kes('500000'), amountIn: kes('500000'), fee: 0, note: 'Deposit to Equity' } });

  // Debts: Ali is three days late; the shop owes Hodan.
  db.debts.push(
    { ...meta('debt-1', addDays(today, -10), 60 * 24 * 10), clientId: 'cl-ali', direction: 'they_owe_us', amount: usd('300'), currency: 'USD', dueDate: addDays(today, -3), note: null },
    { ...meta('debt-2', addDays(today, -2), 60 * 24 * 2), clientId: 'cl-hodan', direction: 'we_owe_them', amount: kes('50000'), currency: 'KES', dueDate: addDays(today, 5), note: 'Balance from SOS order' },
  );
  add({ type: 'debt_payment', record: { ...meta('pay-1', yesterday, 60 * 22), debtId: 'debt-1', amount: usd('100'), accountId: 'acc-e-cash-usd' }, debt: db.debts[0]! });

  // Garissa: a quiet shop, yesterday not closed and no rates today.
  const garissaBoard: RateBoard = { base: 'USD', rates: { KES: { buy: '129.00', sell: '130.50' } } };
  const garissaQuote = quoteByGive(garissaBoard, { amount: usd('400'), currency: 'USD' }, 'KES')!;
  add({
    type: 'exchange',
    record: {
      ...meta('ex-g1', yesterday, 60 * 20, owner, garissa.id),
      currencyIn: 'USD',
      amountIn: usd('400'),
      accountIn: 'acc-g-cash-usd',
      currencyOut: 'KES',
      amountOut: garissaQuote.amountOut.amount,
      accountOut: 'acc-g-cash-kes',
      rate: garissaQuote.rate,
      clientId: 'cl-abdullahi',
      note: null,
    },
  });

  // ── Close yesterday in Eastleigh, counted exactly as expected ──────────────

  const eastleighAccounts = db.accounts.filter((a) => a.workspaceId === eastleigh.id);
  const upToYesterday = db.entries.filter((entry) => entry.date <= yesterday);
  const expected = accountBalances(eastleighAccounts, upToYesterday);
  for (const acc of eastleighAccounts) {
    const amount = expected.get(acc.id) ?? acc.openingBalance;
    db.closings.push({
      id: `close-${yesterday}-${acc.id}`,
      workspaceId: eastleigh.id,
      date: yesterday,
      accountId: acc.id,
      expected: amount,
      counted: amount,
      difference: 0,
      note: null,
      closedBy: owner.id,
      closedAt: ago(60 * 15),
    });
  }

  // ── Notifications for the owner (in English, the owner's language) ─────────
  // Garissa's "Rates not set" isn't here: the mock writes that one itself once
  // it's past 9:00 there (notifications.list).

  const note = (
    id: string,
    workspaceId: string,
    type: Notification['type'],
    priority: Notification['priority'],
    title: string,
    body: string,
    link: string,
    createdAt: string,
    read = false,
  ): Notification => ({
    id,
    userId: owner.id,
    workspaceId,
    type,
    title,
    body,
    link,
    priority,
    readAt: read ? createdAt : null,
    clearedAt: null,
    createdAt,
  });
  db.notifications.push(
    note('n-amanat', eastleigh.id, 'amanat_withdrawal', 'normal', 'Amanat withdrawn', 'Fatuma Noor withdrew 500.00 USD of amanat.', `/w/${eastleigh.id}/clients`, ago(60)),
    note('n-overdue', eastleigh.id, 'debt_overdue', 'high', "Ali Abdi's debt is overdue", '200.00 USD, due 3 days ago.', `/w/${eastleigh.id}/clients`, ago(180)),
    note('n-not-closed', garissa.id, 'day_not_closed', 'high', "Yesterday wasn't closed", `Sarrif – Garissa didn't close ${yesterday}. Count the cash to close it.`, `/w/${garissa.id}/book`, ago(60 * 15)),
    note('n-summary', eastleigh.id, 'daily_summary', 'normal', `Eastleigh closed ${yesterday}`, 'Every account counted exactly as expected.', `/w/${eastleigh.id}/reports`, ago(60 * 15), true),
    note('n-joined', eastleigh.id, 'invitation_accepted', 'low', 'Amina Hassan joined Sarrif – Eastleigh', 'Amina Hassan is an Editor there now.', `/w/${eastleigh.id}/team`, cashier.createdAt, true),
  );

  return db;
}
