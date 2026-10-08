import {
  type Action,
  ApiError,
  type BookFilter,
  type BookRow,
  businessDate,
  can,
  createAccountSchema,
  createAmanatSchema,
  createClientSchema,
  createDebtPaymentSchema,
  createDebtSchema,
  createExchangeSchema,
  createExpenseSchema,
  createTransferSchema,
  createWorkspaceSchema,
  type CurrencyCode,
  daySummary,
  type Debt,
  debtState,
  entriesFor,
  type Id,
  isCurrencyCode,
  LedgerError,
  onboardingSchema,
  type LedgerSource,
  profileSchema,
  ratedCurrencies,
  type SarrifApi,
  sendCodeSchema,
  setRatesSchema,
  toMinor,
  type User,
  verifyCodeSchema,
  type Workspace,
} from '@sarrif/core';
import type { ZodType } from 'zod';

import { getDb, type MockDb, resetDb, saveDb } from './db';
import { DEMO_CODE } from './seed';

// The backend, faked in the browser. It keeps the rules the real one will:
// sign-in required, membership and role checked on every call, inputs parsed
// with the shared schemas, entries written by the shared ledger, closed days
// locked. If a screen works against this, it works against Supabase.

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

/** A little delay, so loading states get exercised like on a real network. */
const latency = () => new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180));

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      fields[issue.path.join('.')] ??= issue.message;
    }
    throw new ApiError('invalid', 'errors.invalid', fields);
  }
  return result.data;
}

function signedIn(db: MockDb): User {
  const user = db.users.find((u) => u.id === db.sessionUserId);
  if (!user) throw new ApiError('unauthenticated');
  return user;
}

/** The workspace, if the signed-in user is a member allowed to do `action` there. */
function access(db: MockDb, workspaceId: Id, action: Action = 'view') {
  const user = signedIn(db);
  const workspace = db.workspaces.find((w) => w.id === workspaceId && w.status === 'active');
  const member = db.members.find((m) => m.workspaceId === workspaceId && m.userId === user.id);
  if (!workspace || !member) throw new ApiError('not_found');
  if (!can(member.role, action)) throw new ApiError('forbidden');
  return { db, user, workspace, role: member.role };
}

const today = (workspace: Workspace) => businessDate(workspace.timeZone);

function assertDayOpen(db: MockDb, workspaceId: Id, date: string) {
  if (db.closings.some((c) => c.workspaceId === workspaceId && c.date === date)) {
    throw new ApiError('day_closed');
  }
}

/** Saves a money record: its entries and its activity row, all or nothing. */
function commit(db: MockDb, user: User, source: LedgerSource, save: () => void) {
  let drafts;
  try {
    drafts = entriesFor(source, (id) => db.accounts.find((a) => a.id === id));
  } catch (error) {
    if (error instanceof LedgerError) throw new ApiError('invalid', 'errors.invalid', { ledger: error.code });
    throw error;
  }
  save();
  const createdAt = nowIso();
  for (const draft of drafts) {
    db.entries.push({ ...draft, id: newId(), createdBy: user.id, createdAt, deletedAt: null });
  }
  db.activity.push({
    id: newId(),
    workspaceId: source.record.workspaceId,
    userId: user.id,
    action: 'create',
    recordType: source.type,
    recordId: source.record.id,
    before: null,
    after: source.record,
    reason: null,
    createdAt,
  });
  saveDb();
}

/** The common fields of a new record, dated today in the shop's time zone. */
function newRecord(db: MockDb, user: User, workspace: Workspace) {
  const date = today(workspace);
  assertDayOpen(db, workspace.id, date);
  return { id: newId(), workspaceId: workspace.id, date, createdBy: user.id, createdAt: nowIso(), deletedAt: null };
}

function bookRows(db: MockDb, workspaceId: Id): BookRow[] {
  const userName = (id: Id) => ({ id, name: db.users.find((u) => u.id === id)?.name ?? '—' });
  const clientRef = (id: Id | null) => {
    const found = id ? db.clients.find((c) => c.id === id) : undefined;
    return found ? { id: found.id, name: found.name } : null;
  };
  const accountRef = (id: Id) => ({ id, name: db.accounts.find((a) => a.id === id)?.name ?? '—' });
  const closed = new Set(db.closings.filter((c) => c.workspaceId === workspaceId).map((c) => c.date));
  const live = <T extends { deletedAt: string | null; workspaceId: Id }>(rows: T[]) =>
    rows.filter((row) => row.deletedAt === null && row.workspaceId === workspaceId);
  const base = (record: { id: Id; date: string; createdAt: string; createdBy: Id }) => ({
    id: record.id,
    date: record.date,
    createdAt: record.createdAt,
    recordedBy: userName(record.createdBy),
    locked: closed.has(record.date),
  });

  const rows: BookRow[] = [
    ...live(db.exchanges).map((r): BookRow => ({
      ...base(r),
      type: 'exchange',
      client: clientRef(r.clientId),
      in: { amount: r.amountIn, currency: r.currencyIn },
      out: { amount: r.amountOut, currency: r.currencyOut },
      rate: r.rate,
      accounts: [accountRef(r.accountIn), accountRef(r.accountOut)],
      detail: null,
      note: r.note,
    })),
    ...live(db.expenses).map((r): BookRow => ({
      ...base(r),
      type: 'expense',
      client: null,
      in: null,
      out: { amount: r.amount, currency: r.currency },
      rate: null,
      accounts: [accountRef(r.accountId)],
      detail: r.category,
      note: r.note,
    })),
    ...live(db.amanats).map((r): BookRow => {
      const money = { amount: r.amount, currency: r.currency };
      return {
        ...base(r),
        type: 'amanat',
        client: clientRef(r.clientId),
        in: r.type === 'deposit' ? money : null,
        out: r.type === 'withdrawal' ? money : null,
        rate: null,
        accounts: [accountRef(r.accountId)],
        detail: r.type,
        note: r.note,
      };
    }),
    ...live(db.debts).map((r): BookRow => ({
      ...base(r),
      type: 'debt',
      client: clientRef(r.clientId),
      in: null,
      out: null,
      rate: null,
      accounts: [],
      detail: r.direction,
      note: r.note,
    })),
    ...live(db.debtPayments).map((r): BookRow => {
      const debt = db.debts.find((d) => d.id === r.debtId);
      const money = { amount: r.amount, currency: debt?.currency ?? 'USD' };
      const theyPay = debt?.direction === 'they_owe_us';
      return {
        ...base(r),
        type: 'debt_payment',
        client: clientRef(debt?.clientId ?? null),
        in: theyPay ? money : null,
        out: theyPay ? null : money,
        rate: null,
        accounts: [accountRef(r.accountId)],
        detail: debt?.direction ?? null,
        note: null,
      };
    }),
    ...live(db.transfers).map((r): BookRow => {
      const from = db.accounts.find((a) => a.id === r.fromAccountId);
      const to = db.accounts.find((a) => a.id === r.toAccountId);
      return {
        ...base(r),
        type: 'transfer',
        client: null,
        in: to && !r.toWorkspaceId ? { amount: r.amountIn, currency: to.currency } : null,
        out: from ? { amount: r.amountOut + r.fee, currency: from.currency } : null,
        rate: null,
        accounts: [accountRef(r.fromAccountId), accountRef(r.toAccountId)],
        detail: null,
        note: r.note,
      };
    }),
    // Money arriving from another shop shows in the receiving shop's book too.
    ...db.transfers
      .filter((r) => r.deletedAt === null && r.toWorkspaceId === workspaceId)
      .map((r): BookRow => {
        const to = db.accounts.find((a) => a.id === r.toAccountId);
        return {
          ...base(r),
          type: 'transfer',
          client: null,
          in: to ? { amount: r.amountIn, currency: to.currency } : null,
          out: null,
          rate: null,
          accounts: [accountRef(r.fromAccountId), accountRef(r.toAccountId)],
          detail: null,
          note: r.note,
        };
      }),
  ];
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matchesFilter(row: BookRow, filter: BookFilter): boolean {
  if (filter.type) {
    const type = row.type === 'debt_payment' ? 'debt' : row.type;
    if (type !== filter.type) return false;
  }
  const search = filter.search?.trim().toLowerCase();
  if (search) {
    const haystack = `${row.client?.name ?? ''} ${row.note ?? ''}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  return true;
}

export const mockApi: SarrifApi = {
  auth: {
    async sendCode(input) {
      await latency();
      const { phone } = parse(sendCodeSchema, input);
      return { phone };
    },

    async verifyCode(input) {
      await latency();
      const db = getDb();
      const { phone, code, profile } = parse(verifyCodeSchema, input);
      if (code !== DEMO_CODE) throw new ApiError('invalid', 'errors.wrongCode', { code: 'errors.wrongCode' });
      let user = db.users.find((u) => u.phone === phone);
      const isNewUser = !user?.name;
      if (!user) {
        user = { id: newId(), name: '', phone, email: null, avatar: null, language: 'en', createdAt: nowIso() };
        db.users.push(user);
      }
      // Sign-up details only fill an empty profile; they never rename an existing account.
      if (isNewUser && profile) Object.assign(user, profile);
      db.sessionUserId = user.id;
      saveDb();
      return { user, isNewUser };
    },

    async getSession() {
      await latency();
      const db = getDb();
      return db.users.find((u) => u.id === db.sessionUserId) ?? null;
    },

    async updateProfile(input) {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      Object.assign(user, parse(profileSchema, input));
      saveDb();
      return user;
    },

    async signOut() {
      await latency();
      const db = getDb();
      db.sessionUserId = null;
      saveDb();
    },
  },

  market: {
    // Real numbers even in the mock: ExchangeRate-API's open feed (no key,
    // updated daily, asks for a credit line). The real backend will fetch and
    // cache this server-side instead of every browser calling it.
    async rates(base) {
      let body: { result?: string; time_last_update_unix?: number; rates?: Record<string, number> };
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
        body = await response.json();
      } catch {
        throw new ApiError('unavailable');
      }
      if (body.result !== 'success' || !body.rates) throw new ApiError('unavailable');
      const rates: Partial<Record<CurrencyCode, string>> = {};
      for (const [code, value] of Object.entries(body.rates)) {
        if (isCurrencyCode(code) && Number.isFinite(value) && value > 0) rates[code] = String(value);
      }
      return {
        base,
        rates,
        updatedAt: new Date((body.time_last_update_unix ?? Date.now() / 1000) * 1000).toISOString(),
        source: 'ExchangeRate-API',
      };
    },
  },

  onboarding: {
    async complete(input) {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      const { profile, shop, accounts, rates } = parse(onboardingSchema, input);
      const now = nowIso();

      // Everything is built first and saved once at the end: all or nothing,
      // like the database transaction the real backend will use.
      Object.assign(user, profile);
      const workspace: Workspace = {
        id: newId(),
        ...shop,
        closingTime: '21:00',
        largeTransactionLimit: toMinor('5000', shop.baseCurrency),
        ownerId: user.id,
        status: 'active',
        createdAt: now,
      };
      db.workspaces.push(workspace);
      db.members.push({ id: newId(), workspaceId: workspace.id, userId: user.id, role: 'owner', joinedAt: now });
      for (const account of accounts) {
        db.accounts.push({ id: newId(), workspaceId: workspace.id, ...account, archived: false, createdAt: now });
      }
      const today = businessDate(workspace.timeZone);
      for (const pair of rates) {
        db.rates.push({ id: newId(), workspaceId: workspace.id, date: today, ...pair, setBy: user.id, setAt: now });
      }
      saveDb();
      return { user, workspace };
    },
  },

  workspaces: {
    async listMine() {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      return db.members
        .filter((m) => m.userId === user.id)
        .flatMap((m) => {
          const workspace = db.workspaces.find((w) => w.id === m.workspaceId && w.status === 'active');
          return workspace ? [{ workspace, role: m.role }] : [];
        });
    },

    async create(input) {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      const data = parse(createWorkspaceSchema, input);
      const workspace: Workspace = {
        id: newId(),
        ...data,
        closingTime: '21:00',
        largeTransactionLimit: toMinor('5000', data.baseCurrency),
        ownerId: user.id,
        status: 'active',
        createdAt: nowIso(),
      };
      db.workspaces.push(workspace);
      db.members.push({ id: newId(), workspaceId: workspace.id, userId: user.id, role: 'owner', joinedAt: workspace.createdAt });
      saveDb();
      return workspace;
    },
  },

  accounts: {
    async list(workspaceId) {
      await latency();
      const { db } = access(getDb(), workspaceId);
      return db.accounts.filter((a) => a.workspaceId === workspaceId);
    },

    async create(workspaceId, input) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId, 'manage_accounts');
      const data = parse(createAccountSchema, input);
      if (!workspace.currencies.includes(data.currency)) {
        throw new ApiError('invalid', 'errors.invalid', { currency: 'validation.currencies' });
      }
      const account = { id: newId(), workspaceId, ...data, archived: false, createdAt: nowIso() };
      db.accounts.push(account);
      saveDb();
      return account;
    },
  },

  rates: {
    async forDate(workspaceId, date) {
      await latency();
      const { db } = access(getDb(), workspaceId);
      return db.rates.filter((r) => r.workspaceId === workspaceId && r.date === date);
    },

    async set(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'set_rates');
      const { date, rates } = parse(setRatesSchema, input);
      const allowed = ratedCurrencies(workspace);
      for (const pair of rates) {
        if (!allowed.includes(pair.currency)) {
          throw new ApiError('invalid', 'errors.invalid', { [pair.currency]: 'validation.currencies' });
        }
        db.rates = db.rates.filter((r) => !(r.workspaceId === workspaceId && r.date === date && r.currency === pair.currency));
        db.rates.push({ id: newId(), workspaceId, date, ...pair, setBy: user.id, setAt: nowIso() });
      }
      saveDb();
      return db.rates.filter((r) => r.workspaceId === workspaceId && r.date === date);
    },
  },

  clients: {
    async list(workspaceId) {
      await latency();
      const { db } = access(getDb(), workspaceId);
      return db.clients.filter((c) => c.workspaceId === workspaceId).sort((a, b) => a.name.localeCompare(b.name));
    },

    async create(workspaceId, input) {
      await latency();
      const { db } = access(getDb(), workspaceId, 'record');
      const client = { id: newId(), workspaceId, ...parse(createClientSchema, input), createdAt: nowIso() };
      db.clients.push(client);
      saveDb();
      return client;
    },
  },

  records: {
    async createExchange(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const record = { ...newRecord(db, user, workspace), ...parse(createExchangeSchema, input) };
      commit(db, user, { type: 'exchange', record }, () => db.exchanges.push(record));
      return record;
    },

    async createExpense(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const record = { ...newRecord(db, user, workspace), ...parse(createExpenseSchema, input) };
      commit(db, user, { type: 'expense', record }, () => db.expenses.push(record));
      return record;
    },

    async createAmanat(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const record = { ...newRecord(db, user, workspace), ...parse(createAmanatSchema, input) };
      commit(db, user, { type: 'amanat', record }, () => db.amanats.push(record));
      return record;
    },

    async createDebt(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const record: Debt = { ...newRecord(db, user, workspace), ...parse(createDebtSchema, input) };
      // A debt on its own moves no money, so it has no entries; its payments do.
      db.debts.push(record);
      saveDb();
      return record;
    },

    async createDebtPayment(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const data = parse(createDebtPaymentSchema, input);
      const debt = db.debts.find((d) => d.id === data.debtId && d.workspaceId === workspaceId && d.deletedAt === null);
      if (!debt) throw new ApiError('not_found');
      if (data.amount > debtState(debt, db.debtPayments).remaining) {
        throw new ApiError('invalid', 'errors.invalid', { amount: 'validation.amount' });
      }
      const record = { ...newRecord(db, user, workspace), ...data };
      commit(db, user, { type: 'debt_payment', record, debt }, () => db.debtPayments.push(record));
      return record;
    },

    async createTransfer(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const data = parse(createTransferSchema, input);
      if (data.toWorkspaceId && data.toWorkspaceId !== workspaceId) {
        // Shop to shop: only between shops with the same owner, and you must be able to record in both.
        const target = access(db, data.toWorkspaceId, 'record').workspace;
        if (target.ownerId !== workspace.ownerId) throw new ApiError('forbidden');
      }
      const record = { ...newRecord(db, user, workspace), ...data };
      commit(db, user, { type: 'transfer', record }, () => db.transfers.push(record));
      return record;
    },
  },

  book: {
    async list(workspaceId, filter = {}) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const date = filter.date ?? today(workspace);
      return bookRows(db, workspaceId).filter((row) => row.date === date && matchesFilter(row, filter));
    },
  },

  summary: {
    async day(workspaceId, date) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const day = date ?? today(workspace);
      const inShop = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((row) => row.workspaceId === workspaceId);
      return daySummary({
        workspace,
        date: day,
        accounts: inShop(db.accounts),
        entries: inShop(db.entries),
        rates: inShop(db.rates).filter((r) => r.date === day),
        exchanges: inShop(db.exchanges),
        expenses: inShop(db.expenses),
        amanats: inShop(db.amanats),
        debts: inShop(db.debts),
        debtPayments: inShop(db.debtPayments),
      });
    },
  },
};

// Handy in the browser console while building screens.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as { sarrifMock: object }).sarrifMock = {
    reset: () => {
      resetDb();
      window.location.reload();
    },
    db: getDb,
  };
}
