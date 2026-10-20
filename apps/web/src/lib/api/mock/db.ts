import type {
  Account,
  ActivityLog,
  Amanat,
  Client,
  DailyClosing,
  DailyRate,
  Debt,
  DebtPayment,
  Entry,
  Exchange,
  Expense,
  Invitation,
  Member,
  Notification,
  Transfer,
  User,
  Workspace,
} from '@sarrif/core';
import { addDays, businessDate, closingLines, type CurrencyCode, entriesFor, exchangeShillings, monthStart, quoteByGive, type RateBoard, toMinor } from '@sarrif/core';

import { seedDb } from './seed';

// The mock backend's "database": one object, kept in this browser's
// localStorage so what you record survives a refresh. Each table here is a
// table in Postgres later. Nothing outside lib/api/mock may import this.

export interface MockDb {
  version: typeof VERSION;
  users: User[];
  workspaces: Workspace[];
  members: Member[];
  accounts: Account[];
  rates: DailyRate[];
  entries: Entry[];
  clients: Client[];
  exchanges: Exchange[];
  expenses: Expense[];
  transfers: Transfer[];
  amanats: Amanat[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  closings: DailyClosing[];
  activity: ActivityLog[];
  notifications: Notification[];
  /** Added after version 2: missing in older saved data until first used. */
  invitations?: Invitation[];
  /** Who is signed in on this browser. */
  sessionUserId: string | null;
  /**
   * Demo sign-in only: user id → password, in plain text in this browser's
   * storage. Never real credentials: with Supabase set, sign-in is Supabase's.
   * The seeded owner and cashier use DEMO_PASSWORD without an entry.
   */
  passwords?: Record<string, string>;
  /** Shops that already got the sample month (development only). */
  sampledShopsV2?: string[];
  /** Shops that got today's sample exchanges, as "shop:date:count" (development only). */
  sampledExchanges?: string[];
  /** Shops whose sample month got its daily rates and closings (development only). */
  sampledHistory?: string[];
}

/** Bump when the shape changes: old saved data is thrown away and reseeded. */
const VERSION = 2;
const STORAGE_KEY = 'sarrif-mock-db';

let db: MockDb | null = null;

function load(): MockDb | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as MockDb | (Omit<MockDb, 'version' | 'notifications'> & { version: 1 })) : null;
    // Version 1 had no notifications: keep everything recorded, start them empty.
    const current: MockDb | null = parsed?.version === 1 ? { ...parsed, version: VERSION, notifications: [] } : parsed?.version === VERSION ? parsed : null;
    return current;
  } catch {
    return null;
  }
}

export function getDb(): MockDb {
  db ??= load() ?? seedDb();
  if (process.env.NODE_ENV === 'development') {
    fillSampleBalances(db);
    fillSampleExchanges(db);
    fillSampleHistory(db);
  }
  db.invitations ??= [];
  return db;
}

export function saveDb(): void {
  if (typeof window === 'undefined' || !db) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the data still lives until the tab closes.
  }
}

/**
 * Every balance back to zero in the signed-in user's shops: all records and
 * their entries (and day closings) gone, opening balances 0. The user, shops,
 * accounts and rates stay. Also on `window.sarrifMock.clearRecords()` in
 * development.
 */
export function clearRecords(): void {
  const current = getDb();
  const shops = new Set(current.members.filter((m) => m.userId === current.sessionUserId).map((m) => m.workspaceId));
  const elsewhere = <T extends { workspaceId: string }>(rows: T[]) => rows.filter((row) => !shops.has(row.workspaceId));
  current.entries = elsewhere(current.entries);
  current.exchanges = elsewhere(current.exchanges);
  current.expenses = elsewhere(current.expenses);
  current.transfers = elsewhere(current.transfers);
  current.amanats = elsewhere(current.amanats);
  current.debts = elsewhere(current.debts);
  current.debtPayments = elsewhere(current.debtPayments);
  current.closings = elsewhere(current.closings);
  current.activity = elsewhere(current.activity);
  for (const account of current.accounts) {
    if (shops.has(account.workspaceId)) account.openingBalance = 0;
  }
  saveDb();
}

/** Whole units each account holds today in the sample, by currency and cash or not. */
const SAMPLE_BALANCE: Record<string, { cash: number; other: number }> = {
  USD: { cash: 20_000, other: 25_000 },
  KES: { cash: 550_000, other: 1_500_000 },
};

/** The rates the sample's exchanges were made at. */
const SAMPLE_BOARD: RateBoard = { base: 'USD', rates: { KES: { buy: '129.00', sell: '130.50' } } };

/** Same numbers every time for the same shop and day. */
function seededRandom(seed: string) {
  let state = [...seed].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 7);
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) | 0;
    return ((state >>> 8) & 0xffff) / 0x10000;
  };
}

/**
 * Sample money for one shop. Every day this month before today gets a few
 * real exchanges (USD for KSh both ways, through cash, M-Pesa and Salaam),
 * written through the ledger like any other record. Then each account's
 * starting money is worked back so that today it holds exactly the sample
 * balance: Cash USD 20,000, other USD (Salaam) 25,000, Cash KES 550,000,
 * other KES (M-Pesa) 1,500,000. Other currencies are left as they are.
 */
function sampleShop(current: MockDb, workspaceId: string): void {
  const workspace = current.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return;
  const accounts = current.accounts.filter((a) => a.workspaceId === workspaceId && !a.archived);
  const pick = (currency: CurrencyCode, cash: boolean) => accounts.find((a) => a.currency === currency && (a.type === 'cash') === cash);
  const usd = [pick('USD', true), pick('USD', false)].filter((a) => a !== undefined);
  const kes = [pick('KES', true), pick('KES', false)].filter((a) => a !== undefined);
  const lookup = (id: string) => current.accounts.find((a) => a.id === id);
  const today = businessDate(workspace.timeZone);
  const createdBy = current.sessionUserId ?? '';

  if (usd.length > 0 && kes.length > 0) {
    for (let date = monthStart(today); date < today; date = addDays(date, 1)) {
      const random = seededRandom(`${workspaceId}:${date}`);
      const count = 2 + Math.floor(random() * 3);
      for (let i = 0; i < count; i++) {
        const dollars = 200 + Math.round((random() * 2800) / 50) * 50;
        const usdAccount = usd[Math.floor(random() * usd.length)]!;
        const kesAccount = kes[Math.floor(random() * kes.length)]!;
        // Alternate: the customer brings dollars, then the next one brings shillings.
        const bringsUsd = i % 2 === 0;
        const give = bringsUsd
          ? { amount: toMinor(dollars, 'USD'), currency: 'USD' as const, account: usdAccount }
          : { amount: toMinor(Math.round(dollars * 130.5), 'KES'), currency: 'KES' as const, account: kesAccount };
        const get = bringsUsd ? { currency: 'KES' as const, account: kesAccount } : { currency: 'USD' as const, account: usdAccount };
        const quote = quoteByGive(SAMPLE_BOARD, { amount: give.amount, currency: give.currency }, get.currency);
        if (!quote) continue;
        const record: Exchange = {
          id: `sample-${workspaceId}-${date}-${i}`,
          workspaceId,
          date,
          createdBy,
          createdAt: `${date}T${String(9 + i * 2).padStart(2, '0')}:00:00.000Z`,
          deletedAt: null,
          currencyIn: give.currency,
          amountIn: give.amount,
          accountIn: give.account.id,
          currencyOut: get.currency,
          amountOut: quote.amountOut.amount,
          accountOut: get.account.id,
          rate: quote.rate,
          clientId: null,
          note: null,
          kind: null,
          customerRate: null,
          percent: null,
          customer: null,
          highlight: null,
        };
        current.exchanges.push(record);
        entriesFor({ type: 'exchange', record }, lookup).forEach((draft, index) => {
          current.entries.push({ ...draft, id: `${record.id}-e${index}`, createdBy, createdAt: record.createdAt, deletedAt: null });
        });
      }
    }
  }

  // Start each account where it has to so it ends today on the sample balance.
  const net = new Map<string, number>();
  for (const entry of current.entries) {
    if (entry.workspaceId === workspaceId && entry.deletedAt === null) net.set(entry.accountId, (net.get(entry.accountId) ?? 0) + entry.amount);
  }
  for (const account of accounts) {
    const sample = SAMPLE_BALANCE[account.currency];
    if (!sample) continue;
    account.openingBalance = toMinor(account.type === 'cash' ? sample.cash : sample.other, account.currency) - (net.get(account.id) ?? 0);
  }
}

/**
 * In development, each of the signed-in user's shops gets the sample month
 * once, the first time it's seen with nothing recorded in it. After that
 * it's left alone, so clearRecords() really does go back to zero.
 */
function fillSampleBalances(current: MockDb): void {
  const sampled = new Set(current.sampledShopsV2 ?? []);
  const fresh = current.members
    .filter((m) => m.userId === current.sessionUserId && !sampled.has(m.workspaceId))
    .map((m) => m.workspaceId)
    .filter((id) => !current.entries.some((entry) => entry.workspaceId === id));
  if (fresh.length === 0) return;
  for (const id of fresh) sampleShop(current, id);
  current.sampledShopsV2 = [...sampled, ...fresh];
  saveDb();
}

const SAMPLE_NAMES = ['Ali', 'Hodan', 'Fatuma', 'Mohamed', 'Abdi', 'Amina', null, null];

/**
 * Fifteen sample exchange rows for today in one shop, for trying the Profit page:
 * dollars bought a little under today's rate and sold a little over it,
 * through cash, Sallam and M-Pesa, spread over the day. Today's rate is set
 * to 129.61 first if the shop hasn't set one, so every row has its profit.
 */
export function sampleExchanges(current: MockDb, workspaceId: string, count = 15): void {
  const workspace = current.workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return;
  const accounts = current.accounts.filter((a) => a.workspaceId === workspaceId && !a.archived);
  const usd = accounts.filter((a) => a.currency === 'USD');
  const kes = accounts.filter((a) => a.currency === 'KES');
  if (usd.length === 0 || kes.length === 0) return;
  const today = businessDate(workspace.timeZone);
  const by = current.sessionUserId ?? '';
  let rate = current.rates.find((r) => r.workspaceId === workspaceId && r.date === today && r.currency === 'KES')?.buy;
  if (!rate) {
    rate = '129.61';
    current.rates.push({ id: `sample-rate-${workspaceId}-${today}`, workspaceId, currency: 'KES', date: today, buy: rate, sell: rate, setBy: by, setAt: new Date().toISOString() });
  }
  const todayRate = Number(rate);
  const random = seededRandom(`${workspaceId}:${today}:exchanges`);
  const lookup = (id: string) => current.accounts.find((a) => a.id === id);
  // Only the ones still missing (an earlier run may have added some).
  const have = new Set(current.exchanges.filter((x) => x.workspaceId === workspaceId && x.date === today && x.id.startsWith('sample-ex-')).map((x) => x.id));
  for (let i = 0; i < count; i++) {
    const bought = random() < 0.55;
    const dollars = 100 + Math.round((random() * 2900) / 50) * 50;
    const customerRate = (bought ? todayRate - (0.5 + random() * 2) : todayRate + (0.1 + random())).toFixed(2);
    const usdAccount = usd[random() < 0.75 ? 0 : usd.length - 1]!;
    const kesAccount = kes[random() < 0.7 ? 0 : kes.length - 1]!;
    const amount = toMinor(dollars, 'USD');
    const shillings = exchangeShillings(amount, customerRate);
    if (have.has(`sample-ex-${workspaceId}-${today}-${i}`)) continue;
    const minutes = 7 * 60 + i * 20;
    const createdAt = `${today}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00.000Z`;
    const sides = bought
      ? { currencyIn: 'USD' as const, amountIn: amount, accountIn: usdAccount.id, currencyOut: 'KES' as const, amountOut: shillings, accountOut: kesAccount.id }
      : { currencyIn: 'KES' as const, amountIn: shillings, accountIn: kesAccount.id, currencyOut: 'USD' as const, amountOut: amount, accountOut: usdAccount.id };
    const record: Exchange = {
      id: `sample-ex-${workspaceId}-${today}-${i}`,
      workspaceId,
      date: today,
      createdBy: by,
      createdAt,
      deletedAt: null,
      ...sides,
      rate: String(sides.amountOut / sides.amountIn),
      todayRate: rate,
      clientId: null,
      note: null,
      kind: bought ? 'bought_usd' : 'sold_usd',
      customerRate,
      percent: null,
      customer: SAMPLE_NAMES[Math.floor(random() * SAMPLE_NAMES.length)] ?? null,
      highlight: null,
    };
    current.exchanges.push(record);
    entriesFor({ type: 'exchange', record }, lookup).forEach((draft, index) => {
      current.entries.push({ ...draft, id: `${record.id}-e${index}`, createdBy: by, createdAt, deletedAt: null });
    });
  }
}

/** In development: today's 15 sample exchanges, once per shop per day. */
function fillSampleExchanges(current: MockDb): void {
  const done = new Set(current.sampledExchanges ?? []);
  let changed = false;
  for (const m of current.members) {
    if (m.userId !== current.sessionUserId) continue;
    const workspace = current.workspaces.find((w) => w.id === m.workspaceId);
    if (!workspace) continue;
    const key = `${m.workspaceId}:${businessDate(workspace.timeZone)}`;
    if (done.has(key)) continue;
    sampleExchanges(current, m.workspaceId);
    done.add(key);
    changed = true;
  }
  if (!changed) return;
  current.sampledExchanges = [...done];
  saveDb();
}

/**
 * The sample month's past days, for Reports and Close day: a KSh rate on each
 * day that has none (around 129.50, a little different each day), and every
 * day before yesterday closed, counted as expected except one day 50 $ short.
 * Yesterday stays open, so "not closed" can be tried.
 */
function fillSampleHistory(current: MockDb): void {
  const done = new Set(current.sampledHistory ?? []);
  let changed = false;
  for (const m of current.members) {
    if (m.userId !== current.sessionUserId || done.has(m.workspaceId)) continue;
    const workspace = current.workspaces.find((w) => w.id === m.workspaceId);
    if (!workspace) continue;
    const shopId = workspace.id;
    const today = businessDate(workspace.timeZone);
    const by = current.sessionUserId ?? '';
    const inShop = <T extends { workspaceId: string }>(rows: T[]) => rows.filter((row) => row.workspaceId === shopId);
    const days = [...new Set(inShop(current.exchanges).map((x) => x.date))].filter((d) => d < today).sort();
    for (const date of days) {
      if (!current.rates.some((r) => r.workspaceId === shopId && r.date === date && r.currency === 'KES')) {
        const rate = (129 + seededRandom(`${shopId}:${date}:rate`)()).toFixed(2);
        current.rates.push({ id: `sample-rate-${shopId}-${date}`, workspaceId: shopId, currency: 'KES', date, buy: rate, sell: rate, setBy: by, setAt: `${date}T06:00:00.000Z` });
      }
      if (date >= addDays(today, -1) || current.closings.some((c) => c.workspaceId === shopId && c.date === date)) continue;
      const lines = closingLines(inShop(current.accounts), inShop(current.entries), inShop(current.amanats), date);
      const short = days.indexOf(date) === 2;
      lines.forEach((line, index) => {
        const off = short && index === 0 && line.account.currency === 'USD' ? -toMinor(50, 'USD') : 0;
        current.closings.push({
          id: `sample-close-${shopId}-${date}-${index}`,
          workspaceId: shopId,
          date,
          accountId: line.account.id,
          expected: line.expected,
          counted: line.expected + off,
          difference: off,
          note: off ? 'Counted twice, still short' : null,
          closedBy: by,
          closedAt: `${date}T18:30:00.000Z`,
        });
      });
    }
    done.add(shopId);
    changed = true;
  }
  if (!changed) return;
  current.sampledHistory = [...done];
  saveDb();
}

/**
 * The sample month again in the signed-in user's shops: records cleared, then
 * sampleShop. Also on `window.sarrifMock.sampleBalances()` in development.
 */
export function sampleBalances(): void {
  clearRecords();
  const current = getDb();
  for (const m of current.members) if (m.userId === current.sessionUserId) sampleShop(current, m.workspaceId);
  saveDb();
}

/** Back to the demo shops. Also on `window.sarrifMock.reset()` in development. */
export function resetDb(): void {
  db = seedDb();
  saveDb();
}
