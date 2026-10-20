import {
  type Action,
  ApiError,
  type BookFilter,
  type BookRow,
  businessDate,
  can,
  completeProfileSchema,
  createAccountSchema,
  emailLinkSchema,
  logInSchema,
  newPasswordSchema,
  signUpSchema,
  createAmanatSchema,
  holdAmanatSchema,
  createClientSchema,
  createDebtPaymentSchema,
  createDebtSchema,
  createDealSchema,
  createExchangeSchema,
  type Account,
  accountKind,
  dealProfit,
  exchangeShillings,
  sallamAmounts,
  fromMinor,
  createExpenseSchema,
  createTransferSchema,
  createWorkspaceSchema,
  updateAccountSchema,
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
  missingRates,
  rateBoard,
  type SarrifApi,
  setRatesSchema,
  toMinor,
  type User,
  type Workspace,
  dailyNotificationId,
  isNotificationKept,
  type Language,
  overdueRates,
  type ActivityAction,
  type ActivityLog,
  closeDaySchema,
  closingDifference,
  closingLines,
  countsMissingNotes,
  inviteSchema,
  isLastOwner,
  type Money,
  reopenDaySchema,
  report,
  ROLES,
  updateWorkspaceSchema,
} from '@sarrif/core';
import type { output, ZodType } from 'zod';

import { clearRecords, getDb, type MockDb, reloadDb, resetDb, sampleBalances, saveDb, takeSessionFromAuth } from './db';
import { DEMO_PASSWORD } from './seed';

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

/** One line in the Activity log (append-only). */
function log(db: MockDb, workspaceId: Id, user: User, action: ActivityAction, recordType: string, recordId: Id, before: unknown, after: unknown, reason: string | null = null) {
  db.activity.push({ id: newId(), workspaceId, userId: user.id, action, recordType, recordId, before, after, reason, createdAt: nowIso() });
}

const userRef = (db: MockDb, id: Id) => ({ id, name: db.users.find((u) => u.id === id)?.name || '—' });

/** What an Activity log line is about: an amount and a name, read off the record it saved. */
function activityDetail(db: MockDb, activity: ActivityLog): { money: Money | null; detail: string | null } {
  const record = (activity.after ?? activity.before) as Record<string, unknown> | Record<string, unknown>[] | null;
  if (!record) return { money: null, detail: null };
  if (Array.isArray(record)) {
    // Rates set: "KES 129.61".
    const rates = record.filter((r) => typeof r.buy === 'string').map((r) => `${String(r.currency)} ${String(r.buy)}`);
    return { money: null, detail: rates.join(' · ') || null };
  }
  const money = (amount: unknown, currency: unknown): Money | null => (typeof amount === 'number' && typeof currency === 'string' && isCurrencyCode(currency) ? { amount, currency } : null);
  const accountName = (id: unknown) => db.accounts.find((a) => a.id === id)?.name ?? '—';
  switch (activity.recordType) {
    case 'exchange': {
      const dollars = record.currencyIn === 'USD' ? money(record.amountIn, 'USD') : money(record.amountOut, record.currencyOut);
      return { money: dollars, detail: typeof record.customer === 'string' ? record.customer : null };
    }
    case 'expense':
      return { money: money(record.amount, record.currency), detail: typeof record.category === 'string' ? record.category : null };
    case 'amanat':
      return { money: money(record.amount, record.currency), detail: typeof record.clientName === 'string' ? record.clientName : null };
    case 'transfer': {
      const from = db.accounts.find((a) => a.id === record.fromAccountId);
      return { money: from ? money(record.amountOut, from.currency) : null, detail: `${accountName(record.fromAccountId)} → ${accountName(record.toAccountId)}` };
    }
    case 'invitation':
      return { money: null, detail: typeof record.phone === 'string' ? record.phone : null };
    case 'member':
      return { money: null, detail: typeof record.userId === 'string' ? userRef(db, record.userId).name : null };
    case 'workspace':
      return { money: null, detail: typeof record.name === 'string' ? record.name : null };
    default:
      return { money: null, detail: null };
  }
}

/** The common fields of a new record, dated today in the shop's time zone. */
function newRecord(db: MockDb, user: User, workspace: Workspace) {
  const date = today(workspace);
  assertDayOpen(db, workspace.id, date);
  return { id: newId(), workspaceId: workspace.id, date, createdBy: user.id, createdAt: nowIso(), deletedAt: null };
}

/**
 * A profit row's stored fields from what was typed (docs/Sarrif App – Profit
 * forms.md): Sallam always takes dollars from $ Cash into $ Sallam; an
 * exchange moves dollars and shillings between the accounts picked, at the
 * rate given, with that day's rate kept on it so its profit never changes.
 */
function dealFields(db: MockDb, workspace: Workspace, date: string, data: output<typeof createDealSchema>) {
  const shop = db.accounts.filter((a) => a.workspaceId === workspace.id && !a.archived);
  const invalid = (problem: string) => new ApiError('invalid', 'errors.invalid', { form: `profit.problem.${problem}` });
  const common = { clientId: null, note: data.note, customer: data.customer, highlight: null };
  const outPerIn = (out: number, outCurrency: Account['currency'], inAmount: number, inCurrency: Account['currency']) =>
    fromMinor(out, outCurrency).div(fromMinor(inAmount, inCurrency)).toDecimalPlaces(10).toString();

  if (data.type === 'sallam') {
    const cash = shop.find((a) => accountKind(a) === 'cash_usd');
    const sallam = shop.find((a) => accountKind(a) === 'salaam_bank');
    if (!cash || !sallam) throw invalid('noSallam');
    const { cashOut, sallamIn } = sallamAmounts(data.side, data.amount, data.percent);
    return {
      ...common,
      currencyIn: 'USD' as const,
      amountIn: sallamIn,
      accountIn: sallam.id,
      currencyOut: 'USD' as const,
      amountOut: cashOut,
      accountOut: cash.id,
      rate: outPerIn(cashOut, 'USD', sallamIn, 'USD'),
      todayRate: null,
      kind: `sallam_${data.side}`,
      customerRate: null,
      percent: data.percent,
    };
  }

  const usdAccount = shop.find((a) => a.id === data.usdAccountId && a.currency === 'USD');
  const kesAccount = shop.find((a) => a.id === data.kesAccountId && a.currency === 'KES');
  if (!usdAccount || !kesAccount) throw invalid('accounts');
  const today = rateBoard(workspace, db.rates.filter((r) => r.workspaceId === workspace.id && r.date === date)).rates.KES?.buy;
  if (!today) throw invalid('noRate');
  const shillings = exchangeShillings(data.amount, data.rate);
  // Bought $: dollars come in, shillings go out. Sold $: the other way round.
  const sides =
    data.side === 'bought'
      ? { currencyIn: 'USD' as const, amountIn: data.amount, accountIn: usdAccount.id, currencyOut: 'KES' as const, amountOut: shillings, accountOut: kesAccount.id }
      : { currencyIn: 'KES' as const, amountIn: shillings, accountIn: kesAccount.id, currencyOut: 'USD' as const, amountOut: data.amount, accountOut: usdAccount.id };
  return {
    ...common,
    ...sides,
    rate: outPerIn(sides.amountOut, sides.currencyOut, sides.amountIn, sides.currencyIn),
    todayRate: today,
    kind: data.side === 'bought' ? 'bought_usd' : 'sold_usd',
    customerRate: data.rate,
    percent: null,
  };
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

/** "Rates not set" in the receiver's own language, for push and SMS (the app builds its text from params). */
const RATES_NOT_SET: Record<Language, (shop: string, codes: string) => { title: string; body: string }> = {
  en: (shop, codes) => ({ title: 'Rates not set', body: `${shop} has no rate yet today for ${codes}.` }),
  so: (shop, codes) => ({ title: 'Sicirka lama dhigin', body: `${shop} maanta weli sicir uma dhigin ${codes}.` }),
  ar: (shop, codes) => ({ title: 'لم تُحدَّد الأسعار', body: `لا يوجد سعر اليوم في ${shop} لـ ${codes}.` }),
};

/**
 * What the backend's schedule would have written by now, for this user: one
 * "Rates not set" per shop per day, for Owners and Editors, once it's past
 * 9:00 there and rates are still missing.
 */
function writeDueNotifications(db: MockDb, user: User): boolean {
  let wrote = false;
  for (const member of db.members.filter((m) => m.userId === user.id && (m.role === 'owner' || m.role === 'editor'))) {
    const workspace = db.workspaces.find((w) => w.id === member.workspaceId && w.status === 'active');
    if (!workspace) continue;
    const day = today(workspace);
    const missing = overdueRates(
      workspace,
      db.rates.filter((rate) => rate.workspaceId === workspace.id && rate.date === day),
    );
    const id = dailyNotificationId('rates_not_set', workspace.id, day, user.id);
    const params = { shop: workspace.name, currencies: missing.join(', ') };
    const existing = db.notifications.find((n) => n.id === id);
    // Written before notifications had params: give it its details.
    if (existing && !existing.params) {
      existing.params = params;
      wrote = true;
    }
    if (missing.length === 0 || existing) continue;
    db.notifications.push({
      id,
      userId: user.id,
      workspaceId: workspace.id,
      type: 'rates_not_set',
      ...RATES_NOT_SET[user.language](workspace.name, missing.join(', ')),
      params,
      link: `/w/${workspace.id}`,
      priority: 'high',
      readAt: null,
      clearedAt: null,
      createdAt: nowIso(),
    });
    wrote = true;
  }
  return wrote;
}

/** The user's own notifications with these ids. */
function ownNotifications(db: MockDb, user: User, ids: Id[]) {
  const wanted = new Set(ids);
  return db.notifications.filter((n) => n.userId === user.id && wanted.has(n.id));
}

/** A general exchange's deal fields: none. */
const NOT_A_DEAL = { kind: null, customerRate: null, percent: null, customer: null, highlight: null } as const;


/**
 * Deletes (or brings back) exchange rows and their entries, marked rather
 * than erased, on days that are still open, like the real backend will.
 */
function setDeleted(db: MockDb, workspaceId: Id, ids: Id[], deleted: boolean) {
  const { user } = access(db, workspaceId, 'edit_entry_today');
  const wanted = new Set(ids);
  const rows = db.exchanges.filter((x) => x.workspaceId === workspaceId && wanted.has(x.id));
  for (const row of rows) assertDayOpen(db, workspaceId, row.date);
  const now = nowIso();
  for (const row of rows) {
    row.deletedAt = deleted ? now : null;
    for (const entry of db.entries) if (entry.sourceType === 'exchange' && entry.sourceId === row.id) entry.deletedAt = deleted ? now : null;
    db.activity.push({
      id: newId(),
      workspaceId,
      userId: user.id,
      action: deleted ? 'delete' : 'restore',
      recordType: 'exchange',
      recordId: row.id,
      before: deleted ? row : null,
      after: deleted ? null : row,
      reason: null,
      createdAt: now,
    });
  }
  saveDb();
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

/** Tells this browser's other tabs about a demo sign-out. One per tab; null where BroadcastChannel isn't there. */
let channel: BroadcastChannel | null | undefined;
function demoAuthChannel(): BroadcastChannel | null {
  if (channel === undefined) channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('amanat-demo-auth');
  return channel;
}

/** Invited to a shop with this phone: in they go (demo; invites move to email in 1f). */
function acceptInvitations(db: MockDb, user: User) {
  const now = nowIso();
  for (const invitation of db.invitations ?? []) {
    if (!user.phone || invitation.phone !== user.phone || invitation.status !== 'pending' || invitation.expiresAt < now) continue;
    if (!db.members.some((m) => m.workspaceId === invitation.workspaceId && m.userId === user.id)) {
      db.members.push({ id: newId(), workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role, joinedAt: now });
    }
    invitation.status = 'accepted';
  }
}

/** The demo's password check: the seeded owner and cashier use DEMO_PASSWORD. */
function passwordOf(db: MockDb, user: User): string | undefined {
  return db.passwords?.[user.id] ?? (user.id === 'user-owner' || user.id === 'user-cashier' ? DEMO_PASSWORD : undefined);
}

/**
 * When sign-in is Supabase's (lib/api/index.ts), the rest of the mock still
 * needs to know who that is: their account is copied in (a photo the demo
 * already holds stays) and becomes the demo's session. Null signs it out.
 */
export const mockSession = {
  /** From now on the session comes only from adopt(), never from storage. Call before any data call. */
  fromAuthOnly() {
    takeSessionFromAuth();
  },

  adopt(user: User | null) {
    const db = getDb();
    if (!user) {
      if (db.sessionUserId === null) return;
      db.sessionUserId = null;
      saveDb();
      return;
    }
    const known = db.users.find((u) => u.id === user.id);
    if (known) Object.assign(known, { ...user, avatar: known.avatar ?? user.avatar });
    else db.users.push({ ...user });
    db.sessionUserId = user.id;
    acceptInvitations(db, known ?? user);
    saveDb();
  },
};

export const mockApi: SarrifApi = {
  // The demo sign-in, for builds with no Supabase project: no emails are sent,
  // so a new account is signed in straight away. Otherwise the same answers as
  // the real one (one message for a wrong password or an unknown email).
  auth: {
    async signUp(input) {
      await latency();
      const db = getDb();
      const { firstName, email, password, language } = parse(signUpSchema, input);
      // As Supabase does: an address that has an account gets "check your email", nothing more.
      if (db.users.some((u) => u.email === email)) return { status: 'confirm_email' };
      const now = nowIso();
      // No phone yet: the setup wizard asks for it.
      const user: User = { id: newId(), name: firstName, phone: '', email, avatar: null, language, createdAt: now, termsAcceptedAt: now };
      db.users.push(user);
      db.passwords = { ...db.passwords, [user.id]: password };
      db.sessionUserId = user.id;
      acceptInvitations(db, user);
      saveDb();
      return { status: 'signed_in', user };
    },

    async logIn(input) {
      await latency();
      const db = getDb();
      const { email, password } = parse(logInSchema, input);
      const user = db.users.find((u) => u.email === email);
      if (!user || passwordOf(db, user) !== password) {
        throw new ApiError('unauthenticated', 'errors.wrongLogin', { form: 'errors.wrongLogin' });
      }
      db.sessionUserId = user.id;
      acceptInvitations(db, user);
      saveDb();
      return user;
    },

    async signInWithGoogle() {
      await latency();
      throw new ApiError('unavailable', 'errors.googleUnavailable', { form: 'errors.googleUnavailable' });
    },

    async resendConfirmation(input) {
      await latency();
      parse(emailLinkSchema, input);
    },

    async requestPasswordReset(input) {
      await latency();
      parse(emailLinkSchema, input);
    },

    async setNewPassword(input) {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      const { password } = parse(newPasswordSchema, input);
      if (passwordOf(db, user) === password) {
        throw new ApiError('invalid', 'validation.passwordSame', { password: 'validation.passwordSame' });
      }
      db.passwords = { ...db.passwords, [user.id]: password };
      saveDb();
    },

    async completeProfile(input) {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      const { phone, acceptTerms } = parse(completeProfileSchema, input);
      user.phone = phone;
      if (acceptTerms) user.termsAcceptedAt = nowIso();
      acceptInvitations(db, user);
      saveDb();
      return user;
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

    // The demo lives in one browser, so signing out everywhere is the same as here.
    async signOut() {
      await latency();
      const db = getDb();
      db.sessionUserId = null;
      saveDb();
      // This browser's other tabs sign out too.
      demoAuthChannel()?.postMessage('signed-out');
    },

    onSignedOut(listener) {
      const channel = demoAuthChannel();
      if (!channel) return () => undefined;
      const onMessage = (event: MessageEvent) => {
        if (event.data !== 'signed-out') return;
        // The other tab saved the signed-out db; read it again rather than keep this tab's copy.
        reloadDb();
        listener();
      };
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
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
    async update(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'manage_shop');
      const data = parse(updateWorkspaceSchema, input);
      const before = { ...workspace };
      Object.assign(workspace, data);
      log(db, workspaceId, user, 'update_shop', 'workspace', workspaceId, before, { ...workspace });
      saveDb();
      return workspace;
    },

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

    async update(workspaceId, accountId, input) {
      await latency();
      const { db } = access(getDb(), workspaceId, 'manage_accounts');
      const data = parse(updateAccountSchema, input);
      const account = db.accounts.find((a) => a.id === accountId && a.workspaceId === workspaceId);
      if (!account) throw new ApiError('not_found');
      Object.assign(account, data);
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
      log(db, workspaceId, user, 'set_rates', 'rates', date, null, db.rates.filter((r) => r.workspaceId === workspaceId && r.date === date));
      // Its reason gone, "Rates not set" goes too, for everyone it went to.
      if (date === today(workspace) && missingRates(workspace, rateBoard(workspace, db.rates.filter((r) => r.workspaceId === workspaceId && r.date === date))).length === 0) {
        const now = nowIso();
        for (const n of db.notifications) {
          if (n.type === 'rates_not_set' && n.workspaceId === workspaceId && n.id.includes(`:${date}:`) && !n.clearedAt) n.clearedAt = now;
        }
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
      const record = { ...newRecord(db, user, workspace), ...parse(createExchangeSchema, input), ...NOT_A_DEAL };
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

  notifications: {
    async list() {
      await latency();
      const db = getDb();
      const user = signedIn(db);
      if (writeDueNotifications(db, user)) saveDb();
      // Only shops the user is still in.
      const shops = new Set(db.members.filter((m) => m.userId === user.id).map((m) => m.workspaceId));
      return db.notifications
        .filter((n) => n.userId === user.id && shops.has(n.workspaceId) && isNotificationKept(n))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async markRead(ids) {
      await latency();
      const db = getDb();
      const now = nowIso();
      for (const n of ownNotifications(db, signedIn(db), ids)) n.readAt ??= now;
      saveDb();
    },

    async clear(ids) {
      await latency();
      const db = getDb();
      const now = nowIso();
      for (const n of ownNotifications(db, signedIn(db), ids)) n.clearedAt = now;
      saveDb();
    },

    async restore(ids) {
      await latency();
      const db = getDb();
      for (const n of ownNotifications(db, signedIn(db), ids)) n.clearedAt = null;
      saveDb();
    },
  },

  amanat: {
    async list(workspaceId) {
      await latency();
      const { db } = access(getDb(), workspaceId);
      const name = (id: Id, list: { id: Id; name: string }[]) => list.find((x) => x.id === id)?.name ?? '—';
      // Deposits are the amanat; a withdrawal that gave one back marks it returned.
      const givenBack = new Set(db.amanats.filter((a) => a.workspaceId === workspaceId && a.deletedAt === null && a.returnOf).map((a) => a.returnOf));
      const rows = db.amanats
        .filter((a) => a.workspaceId === workspaceId && a.deletedAt === null && a.type === 'deposit')
        .map((amanat) => ({
          amanat,
          clientName: amanat.clientName ?? (amanat.clientId ? name(amanat.clientId, db.clients) : '—'),
          account: { id: amanat.accountId, name: name(amanat.accountId, db.accounts) },
          recordedBy: { id: amanat.createdBy, name: name(amanat.createdBy, db.users) },
          returned: Boolean(amanat.returnedAt) || givenBack.has(amanat.id),
        }));
      const held = rows.filter((r) => !r.returned).sort((a, b) => b.amanat.createdAt.localeCompare(a.amanat.createdAt));
      const back = rows.filter((r) => r.returned).sort((a, b) => (b.amanat.returnedAt ?? '').localeCompare(a.amanat.returnedAt ?? ''));
      return [...held, ...back];
    },

    async hold(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const data = parse(holdAmanatSchema, input);
      const account = db.accounts.find((a) => a.id === data.accountId && a.workspaceId === workspaceId && !a.archived);
      if (!account) throw new ApiError('not_found');
      const record = {
        ...newRecord(db, user, workspace),
        clientId: null,
        clientName: data.clientName,
        type: 'deposit' as const,
        amount: data.amount,
        currency: account.currency,
        accountId: account.id,
        note: data.note,
        returnedAt: null,
      };
      commit(db, user, { type: 'amanat', record }, () => db.amanats.push(record));
      return record;
    },

    async markReturned(workspaceId, amanatId) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const held = db.amanats.find((a) => a.id === amanatId && a.workspaceId === workspaceId && a.deletedAt === null && a.type === 'deposit');
      if (!held) throw new ApiError('not_found');
      if (held.returnedAt) throw new ApiError('invalid', 'errors.invalid', { form: 'amanat.alreadyReturned' });
      // Given back today: the money leaves the account it sat in.
      const record = {
        ...newRecord(db, user, workspace),
        clientId: held.clientId,
        clientName: held.clientName ?? null,
        type: 'withdrawal' as const,
        amount: held.amount,
        currency: held.currency,
        accountId: held.accountId,
        note: null,
        returnOf: held.id,
      };
      commit(db, user, { type: 'amanat', record }, () => {
        db.amanats.push(record);
        held.returnedAt = record.createdAt;
      });
      return held;
    },

    async undoReturn(workspaceId, amanatId) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'record');
      const held = db.amanats.find((a) => a.id === amanatId && a.workspaceId === workspaceId && a.deletedAt === null && a.type === 'deposit');
      const back = db.amanats.find((a) => a.returnOf === amanatId && a.workspaceId === workspaceId && a.deletedAt === null);
      if (!held || !back) throw new ApiError('not_found');
      assertDayOpen(db, workspaceId, back.date);
      const now = nowIso();
      back.deletedAt = now;
      for (const entry of db.entries) if (entry.sourceType === 'amanat' && entry.sourceId === back.id) entry.deletedAt = now;
      held.returnedAt = null;
      log(db, workspaceId, user, 'delete', 'amanat', back.id, back, null);
      saveDb();
      return held;
    },
  },

  closings: {
    async day(workspaceId, date) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const inShop = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((row) => row.workspaceId === workspaceId);
      const counts = inShop(db.closings).filter((c) => c.date === date);
      const first = counts[0];
      return {
        date,
        lines: closingLines(inShop(db.accounts), inShop(db.entries), inShop(db.amanats), date),
        board: rateBoard(workspace, inShop(db.rates).filter((r) => r.date === date)),
        closed: first ? { by: userRef(db, first.closedBy), at: first.closedAt, counts } : null,
      };
    },

    async close(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'close_day');
      const data = parse(closeDaySchema, input);
      if (data.date > today(workspace)) throw new ApiError('invalid', 'errors.invalid', { form: 'closing.future' });
      assertDayOpen(db, workspaceId, data.date);
      const inShop = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((row) => row.workspaceId === workspaceId);
      const lines = closingLines(inShop(db.accounts), inShop(db.entries), inShop(db.amanats), data.date);
      if (lines.some((line) => !data.counts.some((c) => c.accountId === line.account.id))) throw new ApiError('invalid', 'errors.invalid', { form: 'closing.countAll' });
      const missing = countsMissingNotes(lines, data.counts);
      if (missing.length > 0) throw new ApiError('invalid', 'errors.invalid', Object.fromEntries(missing.map((id) => [id, 'closing.noteNeeded'])));
      const closedAt = nowIso();
      const rows = lines.map((line) => {
        const count = data.counts.find((c) => c.accountId === line.account.id)!;
        return {
          id: newId(),
          workspaceId,
          date: data.date,
          accountId: line.account.id,
          expected: line.expected,
          counted: count.counted,
          difference: closingDifference(line.expected, count.counted),
          note: count.note,
          closedBy: user.id,
          closedAt,
        };
      });
      db.closings.push(...rows);
      log(db, workspaceId, user, 'close', 'day', data.date, null, rows);
      saveDb();
      return rows;
    },

    async reopen(workspaceId, input) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'reopen_day');
      const data = parse(reopenDaySchema, input);
      const rows = db.closings.filter((c) => c.workspaceId === workspaceId && c.date === data.date);
      if (rows.length === 0) throw new ApiError('not_found');
      db.closings = db.closings.filter((c) => !(c.workspaceId === workspaceId && c.date === data.date));
      log(db, workspaceId, user, 'reopen', 'day', data.date, rows, null, data.reason);
      saveDb();
    },
  },

  reports: {
    async range(workspaceId, from, to) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const last = to > today(workspace) ? today(workspace) : to;
      if (from > last) throw new ApiError('invalid', 'errors.invalid', { from: 'validation.date' });
      const inShop = <T extends { workspaceId: Id }>(rows: T[]) => rows.filter((row) => row.workspaceId === workspaceId);
      const rates = inShop(db.rates);
      return report({
        from,
        to: last,
        exchanges: inShop(db.exchanges),
        expenses: inShop(db.expenses),
        closings: inShop(db.closings),
        accounts: inShop(db.accounts),
        boardFor: (date) => rateBoard(workspace, rates.filter((r) => r.date === date)),
      });
    },
  },

  activity: {
    async list(workspaceId, date) {
      await latency();
      const { db, user, workspace, role } = access(getDb(), workspaceId, 'view_activity_own');
      const everyone = can(role, 'view_activity_all');
      return db.activity
        .filter((a) => a.workspaceId === workspaceId && (everyone || a.userId === user.id) && businessDate(workspace.timeZone, new Date(a.createdAt)) === date)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((activity) => ({ activity, user: userRef(db, activity.userId), ...activityDetail(db, activity) }));
    },
  },

  team: {
    async list(workspaceId) {
      await latency();
      const { db } = access(getDb(), workspaceId, 'manage_team');
      const invitations = (db.invitations ?? []).filter((i) => i.workspaceId === workspaceId);
      const members = db.members
        .filter((m) => m.workspaceId === workspaceId)
        .map((member) => {
          const user = db.users.find((u) => u.id === member.userId);
          const last = db.activity.filter((a) => a.workspaceId === workspaceId && a.userId === member.userId).reduce((latest, a) => (a.createdAt > latest ? a.createdAt : latest), '');
          const invitation = invitations.find((i) => i.status === 'accepted' && i.phone === user?.phone);
          return {
            member,
            user: { id: member.userId, name: user?.name || '—', phone: user?.phone ?? '' },
            lastActive: last || null,
            invitedBy: invitation ? userRef(db, invitation.invitedBy) : null,
          };
        })
        // Owners first, then Editors, then Viewers; by name within each.
        .sort((a, b) => ROLES.indexOf(a.member.role) - ROLES.indexOf(b.member.role) || a.user.name.localeCompare(b.user.name));
      return { members, invitations: invitations.filter((i) => i.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
    },

    async invite(workspaceId, input) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'manage_team');
      const data = parse(inviteSchema, input);
      const already = db.members.some((m) => m.workspaceId === workspaceId && db.users.find((u) => u.id === m.userId)?.phone === data.phone);
      if (already) throw new ApiError('invalid', 'errors.invalid', { phone: 'team.alreadyIn' });
      db.invitations ??= [];
      // A new invitation to the same phone replaces the old one.
      for (const old of db.invitations) if (old.workspaceId === workspaceId && old.phone === data.phone && old.status === 'pending') old.status = 'cancelled';
      const createdAt = nowIso();
      const invitation = {
        id: newId(),
        workspaceId,
        phone: data.phone,
        email: null,
        role: data.role,
        invitedBy: user.id,
        token: newId(),
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt,
      };
      db.invitations.push(invitation);
      log(db, workspaceId, user, 'invite', 'invitation', invitation.id, null, invitation);
      saveDb();
      return invitation;
    },

    async cancelInvite(workspaceId, invitationId) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'manage_team');
      const invitation = db.invitations?.find((i) => i.id === invitationId && i.workspaceId === workspaceId && i.status === 'pending');
      if (!invitation) throw new ApiError('not_found');
      invitation.status = 'cancelled';
      log(db, workspaceId, user, 'delete', 'invitation', invitation.id, invitation, null);
      saveDb();
    },

    async setRole(workspaceId, memberId, role) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'manage_team');
      if (!ROLES.includes(role)) throw new ApiError('invalid');
      const inShop = db.members.filter((m) => m.workspaceId === workspaceId);
      const member = inShop.find((m) => m.id === memberId);
      if (!member) throw new ApiError('not_found');
      if (role !== 'owner' && isLastOwner(inShop, memberId)) throw new ApiError('invalid', 'errors.invalid', { form: 'team.lastOwner' });
      const before = { ...member };
      member.role = role;
      log(db, workspaceId, user, 'change_role', 'member', member.id, before, { ...member });
      saveDb();
      return member;
    },

    async remove(workspaceId, memberId) {
      await latency();
      const { db, user } = access(getDb(), workspaceId, 'manage_team');
      const inShop = db.members.filter((m) => m.workspaceId === workspaceId);
      const member = inShop.find((m) => m.id === memberId);
      if (!member) throw new ApiError('not_found');
      if (isLastOwner(inShop, memberId)) throw new ApiError('invalid', 'errors.invalid', { form: 'team.lastOwner' });
      db.members = db.members.filter((m) => m.id !== memberId);
      log(db, workspaceId, user, 'remove_member', 'member', member.id, member, null);
      saveDb();
    },
  },

  expenses: {
    async list(workspaceId, date) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const day = date ?? today(workspace);
      const closed = db.closings.some((c) => c.workspaceId === workspaceId && c.date === day);
      const name = (id: Id, list: { id: Id; name: string }[]) => list.find((x) => x.id === id)?.name ?? '—';
      return db.expenses
        .filter((x) => x.workspaceId === workspaceId && x.date === day && x.deletedAt === null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((expense) => ({
          expense,
          account: { id: expense.accountId, name: name(expense.accountId, db.accounts) },
          recordedBy: { id: expense.createdBy, name: name(expense.createdBy, db.users) },
          locked: closed,
        }));
    },
  },

  deals: {
    async list(workspaceId, date) {
      await latency();
      const { db, workspace } = access(getDb(), workspaceId);
      const day = date ?? today(workspace);
      const board = rateBoard(workspace, db.rates.filter((r) => r.workspaceId === workspaceId && r.date === day));
      const closed = db.closings.some((c) => c.workspaceId === workspaceId && c.date === day);
      const ref = (id: Id) => ({ id, name: db.accounts.find((a) => a.id === id)?.name ?? '—' });
      // Every exchange is a deal: what came in, what went out. Newest first.
      return db.exchanges
        .filter((x) => x.workspaceId === workspaceId && x.date === day && x.deletedAt === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((deal) => ({
          deal,
          profit: dealProfit(deal, board),
          from: ref(deal.accountOut),
          to: ref(deal.accountIn),
          recordedBy: { id: deal.createdBy, name: db.users.find((u) => u.id === deal.createdBy)?.name ?? '—' },
          locked: closed,
        }));
    },

    async create(workspaceId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'record');
      const record = { ...newRecord(db, user, workspace), ...dealFields(db, workspace, today(workspace), parse(createDealSchema, input)) };
      commit(db, user, { type: 'exchange', record }, () => db.exchanges.push(record));
      return record;
    },

    async update(workspaceId, dealId, input) {
      await latency();
      const { db, user, workspace } = access(getDb(), workspaceId, 'edit_entry_today');
      const record = db.exchanges.find((x) => x.id === dealId && x.workspaceId === workspaceId && x.deletedAt === null);
      if (!record) throw new ApiError('not_found');
      assertDayOpen(db, workspaceId, record.date);
      const before = { ...record };
      Object.assign(record, dealFields(db, workspace, record.date, parse(createDealSchema, input)));
      // Its money moves again: the old entries go, new ones from the deal as it is now.
      let drafts;
      try {
        drafts = entriesFor({ type: 'exchange', record }, (id) => db.accounts.find((a) => a.id === id));
      } catch (error) {
        Object.assign(record, before);
        if (error instanceof LedgerError) throw new ApiError('invalid', 'errors.invalid', { ledger: error.code });
        throw error;
      }
      const now = nowIso();
      db.entries = db.entries.filter((entry) => !(entry.sourceType === 'exchange' && entry.sourceId === record.id));
      for (const draft of drafts) db.entries.push({ ...draft, id: newId(), createdBy: user.id, createdAt: now, deletedAt: null });
      db.activity.push({ id: newId(), workspaceId, userId: user.id, action: 'edit', recordType: 'exchange', recordId: record.id, before, after: { ...record }, reason: null, createdAt: now });
      saveDb();
      return record;
    },

    async highlight(workspaceId, ids, colour) {
      await latency();
      const { db } = access(getDb(), workspaceId, 'record');
      const wanted = new Set(ids);
      for (const x of db.exchanges) if (x.workspaceId === workspaceId && wanted.has(x.id)) x.highlight = colour;
      saveDb();
    },

    async remove(workspaceId, ids) {
      await latency();
      setDeleted(getDb(), workspaceId, ids, true);
    },

    async restore(workspaceId, ids) {
      await latency();
      setDeleted(getDb(), workspaceId, ids, false);
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
        // The last day before this one with rates, for Rate change.
        previousRates: (() => {
          const before = inShop(db.rates).filter((r) => r.date < day);
          const last = before.reduce((latest, r) => (r.date > latest ? r.date : latest), '');
          return before.filter((r) => r.date === last);
        })(),
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
    /** Your shops' balances back to zero, keeping you, your shops and accounts. */
    clearRecords: () => {
      clearRecords();
      window.location.reload();
    },
    /** Sample money in your shops: Cash USD 20,000, Salaam 25,000, Cash KES 550,000, M-Pesa 1,500,000. */
    sampleBalances: () => {
      sampleBalances();
      window.location.reload();
    },
    db: getDb,
  };
}
