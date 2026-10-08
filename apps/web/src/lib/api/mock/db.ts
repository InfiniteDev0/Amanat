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
  Member,
  Notification,
  Transfer,
  User,
  Workspace,
} from '@sarrif/core';

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
  /** Who is signed in on this browser. */
  sessionUserId: string | null;
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
    if (parsed?.version === 1) return { ...parsed, version: VERSION, notifications: [] };
    return parsed?.version === VERSION ? parsed : null;
  } catch {
    return null;
  }
}

export function getDb(): MockDb {
  db ??= load() ?? seedDb();
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

/** Back to the demo shops. Also on `window.sarrifMock.reset()` in development. */
export function resetDb(): void {
  db = seedDb();
  saveDb();
}
