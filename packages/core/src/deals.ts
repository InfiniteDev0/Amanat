import Decimal from 'decimal.js';

import type { CurrencyCode } from './currencies';
import type { Account, Exchange } from './entities';
import { fromMinor, type Money, toMinor } from './money';
import { midRate, type RateBoard, valueInBase } from './rates';

// The money logic (docs/Sarrif App – Profit forms.md): only three things.
//
// Sallam (profit way 1), dollars only, a %:
//   Sold    Cash $ − A, Sallam $ + A·(1 + p)   → profit + A·p $
//   Bought  Cash $ − A, Sallam $ + A·(1 − p)   → profit − A·p $   (the seller takes the %)
//
// Exchange (profit way 2), dollars ↔ shillings at a rate r, against today's
// rate (KSh per 1 USD), which is kept on the row when it's saved:
//   Bought $  $ + A, KSh − A·r   → profit (today − r)·A KSh
//   Sold $    $ − A, KSh + A·r   → profit (r − today)·A KSh
//
// Move: any account to any account, never profit (the transfer record).
//
// Sallam and exchange rows are stored as exchange records: an amount into
// one account and an amount out of another. Their profit reads straight off
// that (dealResult), for old rows too.

export const ACCOUNT_KINDS = ['cash_usd', 'salaam_bank', 'cash_kes', 'mpesa'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

/** Which of the four usual accounts this is, or null for any other account. */
export function accountKind(account: Pick<Account, 'type' | 'currency'>): AccountKind | null {
  const cash = account.type === 'cash';
  if (account.currency === 'USD') return cash ? 'cash_usd' : 'salaam_bank';
  if (account.currency === 'KES') return cash ? 'cash_kes' : 'mpesa';
  return null;
}

/** A deal's two sides (an exchange record's). */
export type DealSides = Pick<Exchange, 'amountIn' | 'currencyIn' | 'amountOut' | 'currencyOut'> & {
  /** Today's rate when it was saved (USD ↔ KSh); the day's board otherwise. */
  todayRate?: string | null;
};

export interface DealResult {
  /** Same currency, or USD ↔ KSh. */
  kind: 'same' | 'fx';
  /** Null for USD ↔ KSh without today's rate. */
  profit: Money | null;
  /** Same currency: profit / out × 100, 2 decimals. */
  percent: string | null;
  /** USD ↔ KSh: KSh per 1 USD, 2 decimals. */
  rate: string | null;
}

/** The KSh-per-USD rate a deal is measured against: its own, else the board's. */
function todayOf(deal: DealSides, board?: RateBoard): Decimal | null {
  if (deal.todayRate) return new Decimal(deal.todayRate);
  const pair = board?.rates.KES;
  return pair ? midRate(pair) : null;
}

/** What a deal made (or cost), its % or rate. Null for a pair of currencies the shop doesn't deal in. */
export function dealResult(deal: DealSides, board?: RateBoard): DealResult | null {
  if (deal.currencyIn === deal.currencyOut) {
    const profit = deal.amountIn - deal.amountOut;
    const percent = deal.amountOut > 0 ? new Decimal(profit).div(deal.amountOut).times(100).toDecimalPlaces(2).toString() : null;
    return { kind: 'same', profit: { amount: profit, currency: deal.currencyIn }, percent, rate: null };
  }
  const gaveUsd = deal.currencyIn === 'USD' && deal.currencyOut === 'KES';
  const gaveKes = deal.currencyIn === 'KES' && deal.currencyOut === 'USD';
  if (!gaveUsd && !gaveKes) return null;
  const usd = gaveUsd ? deal.amountIn : deal.amountOut;
  const kes = gaveUsd ? deal.amountOut : deal.amountIn;
  const rate = fromMinor(kes, 'KES').div(fromMinor(usd, 'USD')).toDecimalPlaces(2).toString();
  const today = todayOf(deal, board);
  if (!today) return { kind: 'fx', profit: null, percent: null, rate };
  // The dollars' worth at today's rate, against the shillings that changed hands.
  const worth = toMinor(fromMinor(usd, 'USD').times(today), 'KES');
  return { kind: 'fx', profit: { amount: gaveUsd ? worth - kes : kes - worth, currency: 'KES' }, percent: null, rate };
}

/** A deal's profit (negative: a cost). Null when it can't be worked out. */
export function dealProfit(deal: DealSides, board?: RateBoard): Money | null {
  return dealResult(deal, board)?.profit ?? null;
}

export const SALLAM_SIDES = ['sold', 'bought'] as const;
export type SallamSide = (typeof SALLAM_SIDES)[number];

/**
 * A Sallam row: `amount` dollars leave the cash drawer; Sallam receives them
 * plus the % (sold) or less the % (bought). The profit is the difference.
 */
export function sallamAmounts(side: SallamSide, amount: number, percent: string): { cashOut: number; sallamIn: number; profit: Money } {
  const share = new Decimal(percent).div(100);
  const factor = side === 'sold' ? share.plus(1) : new Decimal(1).minus(share);
  const sallamIn = toMinor(fromMinor(amount, 'USD').times(factor), 'USD');
  return { cashOut: amount, sallamIn, profit: { amount: sallamIn - amount, currency: 'USD' } };
}

export const EXCHANGE_SIDES = ['bought', 'sold'] as const;
export type ExchangeSide = (typeof EXCHANGE_SIDES)[number];

/** The shillings for `amount` dollars at `rate` (KSh per 1 USD). */
export function exchangeShillings(amount: number, rate: string): number {
  return toMinor(fromMinor(amount, 'USD').times(rate), 'KES');
}

/**
 * An exchange row's profit in KSh: what the dollars are worth at today's
 * rate against the shillings that changed hands. Null without today's rate.
 */
export function exchangeRowProfit(side: ExchangeSide, amount: number, rate: string, today: string | null | undefined): Money | null {
  if (!today) return null;
  const worth = toMinor(fromMinor(amount, 'USD').times(today), 'KES');
  const shillings = exchangeShillings(amount, rate);
  return { amount: side === 'bought' ? worth - shillings : shillings - worth, currency: 'KES' };
}

/**
 * What arrives in a move: the same amount within a currency; at `rate` (KSh
 * per 1 USD) between dollars and shillings. Null without the rate a change of
 * currency needs, or between currencies the shop doesn't hold.
 */
export function moveArrives(amountOut: number, from: CurrencyCode, to: CurrencyCode, rate?: string | null): number | null {
  if (from === to) return amountOut;
  if (!rate || !new Decimal(rate).gt(0)) return null;
  if (from === 'KES' && to === 'USD') return toMinor(fromMinor(amountOut, 'KES').div(rate), 'USD');
  if (from === 'USD' && to === 'KES') return toMinor(fromMinor(amountOut, 'USD').times(rate), 'KES');
  return null;
}

/** Which list a stored row belongs on: Sallam (dollars for dollars) or Exchange (dollars ↔ shillings). */
export function dealSection(deal: Pick<Exchange, 'currencyIn' | 'currencyOut'>): 'sallam' | 'exchange' {
  return deal.currencyIn === deal.currencyOut ? 'sallam' : 'exchange';
}

/**
 * The day's profit in one currency (the board's base) at the day's rate,
 * next to the per-currency totals. Null without the rate a total needs.
 */
export function chargesTotal(charges: readonly Money[], board: RateBoard): Money | null {
  let total = 0;
  for (const money of charges) {
    const inBase = valueInBase(board, money);
    if (inBase === null) return null;
    total += inBase;
  }
  return { amount: total, currency: board.base };
}

/** The day's profit: every deal's added up per currency (USD, then KSh). */
export function chargesOf(deals: readonly DealSides[], board: RateBoard): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const deal of deals) {
    const profit = dealProfit(deal, board);
    if (profit) totals.set(profit.currency, (totals.get(profit.currency) ?? 0) + profit.amount);
  }
  return usdFirst([...totals].map(([currency, amount]) => ({ amount, currency })));
}

/** USD, then the other currencies as they came. */
function usdFirst(list: Money[]): Money[] {
  return list.sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : 0));
}

/** Sallam profit and exchange profit, apart. */
export function chargesSplit(deals: readonly DealSides[], board: RateBoard): { swap: Money[]; exchange: Money[] } {
  // swap: the Sallam rows (same currency); exchange: dollars ↔ shillings.
  return {
    swap: chargesOf(
      deals.filter((deal) => deal.currencyIn === deal.currencyOut),
      board,
    ),
    exchange: chargesOf(
      deals.filter((deal) => deal.currencyIn !== deal.currencyOut),
      board,
    ),
  };
}

/** Net = profit − expenses, per currency (USD first). A currency with only expenses comes out negative. */
export function netOf(charges: readonly Money[], expenses: readonly Money[]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const money of charges) totals.set(money.currency, (totals.get(money.currency) ?? 0) + money.amount);
  for (const money of expenses) totals.set(money.currency, (totals.get(money.currency) ?? 0) - money.amount);
  return usdFirst([...totals].map(([currency, amount]) => ({ amount, currency })));
}
