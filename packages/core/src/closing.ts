import type { CurrencyCode } from './currencies';
import type { BusinessDate } from './dates';
import type { Account, Amanat, DailyClosing, Entry, Id } from './entities';
import { accountBalances, amanatHeldByAccount } from './ledger';
import { addTo, type Money, totalsToList } from './money';
import { type RateBoard, valueFromBase, valueInBase } from './rates';

// Close day (Build Plan v4, 3.9 and 7.7). Each account is counted at the end
// of the day: expected = opening + everything in − everything out up to and
// including that day. Amanat sits in the accounts too, so the count includes
// it; the sheet shows it apart (own money = expected − amanat held).
// Difference = counted − expected: zero is green, anything else needs a note.

export interface ClosingLine {
  account: Account;
  /** What the account should hold at the end of the day. */
  expected: number;
  /** Clients' money in it (deposits − withdrawals up to that day). */
  amanatHeld: number;
  /** The shop's own: expected − amanat held. */
  own: number;
}

/** What each open account should hold at the end of `date`. */
export function closingLines(accounts: readonly Account[], entries: readonly Entry[], amanats: readonly Amanat[], date: BusinessDate): ClosingLine[] {
  const open = accounts.filter((account) => !account.archived);
  const expected = accountBalances(
    open,
    entries.filter((entry) => entry.date <= date),
  );
  const held = amanatHeldByAccount(amanats.filter((amanat) => amanat.date <= date));
  return open.map((account) => {
    const amount = expected.get(account.id) ?? account.openingBalance;
    const amanatHeld = held.get(account.id) ?? 0;
    return { account, expected: amount, amanatHeld, own: amount - amanatHeld };
  });
}

/** Counted − expected: more in the drawer than there should be is above zero. */
export function closingDifference(expected: number, counted: number): number {
  return counted - expected;
}

/** The accounts whose count is off but has no note: the day can't close until they have one. */
export function countsMissingNotes(lines: readonly ClosingLine[], counts: readonly { accountId: Id; counted: number; note: string | null }[]): Id[] {
  return counts
    .filter((count) => {
      const line = lines.find((l) => l.account.id === count.accountId);
      return line !== undefined && closingDifference(line.expected, count.counted) !== 0 && !count.note?.trim();
    })
    .map((count) => count.accountId);
}

/**
 * Amounts in different currencies as one KSh figure at the day's rate (the
 * sheet's "KSh total" line). Null when a currency has no rate that day.
 */
export function totalInShillings(amounts: readonly Money[], board: RateBoard): Money | null {
  let total = 0;
  for (const money of amounts) {
    if (money.currency === 'KES') {
      total += money.amount;
      continue;
    }
    const inBase = valueInBase(board, money);
    const shillings = inBase === null ? null : valueFromBase(board, inBase, 'KES');
    if (shillings === null) return null;
    total += shillings;
  }
  return { amount: total, currency: 'KES' };
}

/** A closed day's counts added up: the differences per currency (USD first). */
export function closingDifferences(closings: readonly DailyClosing[], accounts: readonly Account[]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const closing of closings) {
    const account = accounts.find((a) => a.id === closing.accountId);
    if (account && closing.difference !== 0) addTo(totals, { amount: closing.difference, currency: account.currency });
  }
  return totalsToList(totals).sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : 0));
}
