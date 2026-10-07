import type { CurrencyCode } from './currencies';
import type {
  Account,
  Amanat,
  Debt,
  DebtPayment,
  DebtStatus,
  Entry,
  Exchange,
  Expense,
  Id,
  Transfer,
} from './entities';
import { addTo, assertMinor } from './money';

// The ledger: every movement of money is an Entry on an Account, and every
// balance is calculated from entries, never typed in.
//
// `entriesFor` is the single place that decides which entries a record
// creates. The backend calls it inside the same transaction that saves the
// record (and writes the activity log); the mock calls it too, so the UI sees
// exactly the balances production will.

export type EntryDraft = Pick<Entry, 'workspaceId' | 'accountId' | 'date' | 'amount' | 'currency' | 'sourceType' | 'sourceId'>;

export type LedgerErrorCode =
  | 'account_not_found'
  | 'account_archived'
  | 'account_other_shop'
  | 'currency_mismatch'
  | 'invalid_amount'
  | 'same_account'
  | 'same_currency';

export class LedgerError extends Error {
  override name = 'LedgerError';
  constructor(
    readonly code: LedgerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type AccountLookup = (id: Id) => Account | undefined;

export type LedgerSource =
  | { type: 'exchange'; record: Exchange }
  | { type: 'expense'; record: Expense }
  | { type: 'transfer'; record: Transfer }
  | { type: 'amanat'; record: Amanat }
  | { type: 'debt_payment'; record: DebtPayment; debt: Debt };

/** The entries a record creates: one or two legs, plus a fee leg on transfers. */
export function entriesFor(source: LedgerSource, accounts: AccountLookup): EntryDraft[] {
  const { type, record } = source;

  // One leg: `amount` (positive) moves in or out of an account.
  const leg = (
    accountId: Id,
    amount: number,
    currency: CurrencyCode,
    direction: 'in' | 'out',
    workspaceId: Id = record.workspaceId,
  ): EntryDraft => {
    const account = accounts(accountId);
    if (!account) {
      throw new LedgerError('account_not_found', `Account ${accountId} not found`);
    }
    if (account.archived) {
      throw new LedgerError('account_archived', `Account ${account.name} is archived`);
    }
    if (account.workspaceId !== workspaceId) {
      throw new LedgerError('account_other_shop', `Account ${account.name} belongs to another shop`);
    }
    if (account.currency !== currency) {
      throw new LedgerError('currency_mismatch', `Account ${account.name} holds ${account.currency}, not ${currency}`);
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new LedgerError('invalid_amount', `Amount must be a positive whole number of minor units, got ${amount}`);
    }
    return {
      workspaceId,
      accountId,
      date: record.date,
      amount: direction === 'in' ? amount : -amount,
      currency,
      sourceType: type,
      sourceId: record.id,
    };
  };

  switch (source.type) {
    case 'exchange': {
      const r = source.record;
      if (r.currencyIn === r.currencyOut) {
        throw new LedgerError('same_currency', 'An exchange needs two different currencies');
      }
      return [leg(r.accountIn, r.amountIn, r.currencyIn, 'in'), leg(r.accountOut, r.amountOut, r.currencyOut, 'out')];
    }
    case 'expense': {
      const r = source.record;
      return [leg(r.accountId, r.amount, r.currency, 'out')];
    }
    case 'amanat': {
      const r = source.record;
      return [leg(r.accountId, r.amount, r.currency, r.type === 'deposit' ? 'in' : 'out')];
    }
    case 'debt_payment': {
      const r = source.record;
      // They pay us back: money in. We pay them back: money out.
      const direction = source.debt.direction === 'they_owe_us' ? 'in' : 'out';
      return [leg(r.accountId, r.amount, source.debt.currency, direction)];
    }
    case 'transfer': {
      const r = source.record;
      if (r.fromAccountId === r.toAccountId) {
        throw new LedgerError('same_account', 'A transfer needs two different accounts');
      }
      const from = accounts(r.fromAccountId);
      const to = accounts(r.toAccountId);
      if (!from || !to) {
        throw new LedgerError('account_not_found', 'Transfer account not found');
      }
      const drafts = [
        leg(from.id, r.amountOut, from.currency, 'out'),
        leg(to.id, r.amountIn, to.currency, 'in', r.toWorkspaceId ?? r.workspaceId),
      ];
      if (r.fee > 0) {
        drafts.push(leg(from.id, r.fee, from.currency, 'out'));
      }
      return drafts;
    }
  }
}

function isLive<T extends { deletedAt: string | null }>(row: T): boolean {
  return row.deletedAt === null;
}

/** Balance = opening balance + sum of live entries, for every account given. */
export function accountBalances(accounts: readonly Account[], entries: readonly Entry[]): Map<Id, number> {
  const balances = new Map<Id, number>(accounts.map((account) => [account.id, account.openingBalance]));
  for (const entry of entries) {
    const current = balances.get(entry.accountId);
    if (current !== undefined && isLive(entry)) {
      balances.set(entry.accountId, assertMinor(current + entry.amount, 'balance'));
    }
  }
  return balances;
}

/** Money in and out of each account on one day. */
export function accountMovements(entries: readonly Entry[], date: string): Map<Id, { in: number; out: number }> {
  const movements = new Map<Id, { in: number; out: number }>();
  for (const entry of entries) {
    if (entry.date !== date || !isLive(entry)) continue;
    const movement = movements.get(entry.accountId) ?? { in: 0, out: 0 };
    if (entry.amount > 0) movement.in += entry.amount;
    else movement.out -= entry.amount;
    movements.set(entry.accountId, movement);
  }
  return movements;
}

/**
 * Amanat held per client per currency: deposits − withdrawals. This money is
 * the clients', a liability, and is shown apart from the shop's own cash.
 */
export function amanatHeld(amanats: readonly Amanat[]): Map<Id, Map<CurrencyCode, number>> {
  const held = new Map<Id, Map<CurrencyCode, number>>();
  for (const amanat of amanats) {
    if (!isLive(amanat)) continue;
    const perCurrency = held.get(amanat.clientId) ?? new Map<CurrencyCode, number>();
    addTo(perCurrency, {
      amount: amanat.type === 'deposit' ? amanat.amount : -amanat.amount,
      currency: amanat.currency,
    });
    held.set(amanat.clientId, perCurrency);
  }
  return held;
}

export interface DebtState {
  paid: number;
  remaining: number;
  status: DebtStatus;
}

/** Debt balance = amount − sum of its payments. */
export function debtState(debt: Debt, payments: readonly DebtPayment[]): DebtState {
  const paid = payments
    .filter((payment) => payment.debtId === debt.id && isLive(payment))
    .reduce((total, payment) => total + payment.amount, 0);
  const remaining = Math.max(debt.amount - paid, 0);
  const status: DebtStatus = remaining === 0 ? 'paid' : paid > 0 ? 'partly_paid' : 'open';
  return { paid, remaining, status };
}
