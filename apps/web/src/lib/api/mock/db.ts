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
  /** Who is signed in on this browser. */
  sessionUserId: string | null;
}

/** Bump when the shape changes: old saved data is thrown away and reseeded. */
const VERSION = 1;
const STORAGE_KEY = 'sarrif-mock-db';

let db: MockDb | null = null;

function load(): MockDb | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as MockDb) : null;
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

/** Back to the demo shops. Also on `window.sarrifMock.reset()` in development. */
export function resetDb(): void {
  db = seedDb();
  saveDb();
}
