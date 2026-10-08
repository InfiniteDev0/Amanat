import Decimal from 'decimal.js';

import type { CurrencyCode } from './currencies';
import { fromMinor, type Money, toMinor } from './money';

// How rates work
//
// Every rate on the board is "units of this currency per 1 unit of the shop's
// base currency", the way the board reads in a dollar market:
//
//   KES  buy 129.00  sell 130.50   (base USD)
//
// buy  = the shop BUYS the base currency at this price. A customer who brings
//        100 USD gets 100 x 129.00 = 12,900 KES.
// sell = the shop SELLS the base currency at this price. A customer who wants
//        100 USD pays 100 x 130.50 = 13,050 KES.
//
// The gap between the two is the shop's margin. Two non-base currencies
// (KES -> SOS) go through the base: KES -> USD at KES's sell, USD -> SOS at
// SOS's buy, so the shop earns the spread on both legs.
//
// Rates are decimal strings everywhere (numeric(18,6) in the database), never
// JS numbers.

export interface RatePair {
  buy: string;
  sell: string;
}

/** The day's board for one shop. The base currency itself is always 1/1. */
export interface RateBoard {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, RatePair>>;
}

/** Decimal places a board rate is stored with: numeric(18,6). */
export const RATE_DECIMALS = 6;
/**
 * Decimal places an exchange's effective rate is stored with: numeric(24,10).
 * More than the board because out-per-in can be tiny (KES -> USD is 0.0076628).
 */
export const EXCHANGE_RATE_DECIMALS = 10;

export function isValidRatePair(pair: RatePair): boolean {
  try {
    const buy = new Decimal(pair.buy);
    const sell = new Decimal(pair.sell);
    return buy.gt(0) && sell.gt(0) && buy.lte(sell);
  } catch {
    return false;
  }
}

/** Halfway between buy and sell: what the shop's stock is "worth" today. */
export function midRate(pair: RatePair): Decimal {
  return new Decimal(pair.buy).plus(pair.sell).div(2);
}

/**
 * What the customer gets per 1 unit of what they give, at today's board, or
 * null when a rate it needs isn't set.
 */
export function effectiveRate(board: RateBoard, from: CurrencyCode, to: CurrencyCode): Decimal | null {
  if (from === to) {
    return null;
  }
  // `from` -> base: the shop sells base, so the customer pays `from`'s sell.
  let perBase: Decimal;
  if (from === board.base) {
    perBase = new Decimal(1);
  } else {
    const pair = board.rates[from];
    if (!pair) return null;
    perBase = new Decimal(1).div(pair.sell);
  }
  // base -> `to`: the shop buys base, so the customer gets `to`'s buy.
  if (to === board.base) {
    return perBase;
  }
  const pair = board.rates[to];
  if (!pair) return null;
  return perBase.times(pair.buy);
}

export interface Quote {
  amountIn: Money;
  amountOut: Money;
  /** amountOut per 1 amountIn, as stored on the exchange. */
  rate: string;
}

/** Customer gives `amountIn` of `from`; how much `to` do they get? */
export function quoteByGive(board: RateBoard, amountIn: Money, to: CurrencyCode): Quote | null {
  const rate = effectiveRate(board, amountIn.currency, to);
  if (!rate) return null;
  const out = fromMinor(amountIn.amount, amountIn.currency).times(rate);
  return {
    amountIn,
    amountOut: { amount: toMinor(out, to), currency: to },
    rate: rate.toDecimalPlaces(EXCHANGE_RATE_DECIMALS).toString(),
  };
}

/** Customer wants `amountOut` of `to`; how much `from` must they give? */
export function quoteByGet(board: RateBoard, from: CurrencyCode, amountOut: Money): Quote | null {
  const rate = effectiveRate(board, from, amountOut.currency);
  if (!rate) return null;
  const amountInDecimal = fromMinor(amountOut.amount, amountOut.currency).div(rate);
  return {
    amountIn: { amount: toMinor(amountInDecimal, from), currency: from },
    amountOut,
    rate: rate.toDecimalPlaces(EXCHANGE_RATE_DECIMALS).toString(),
  };
}

/**
 * An amount's worth in the base currency at today's mid rate (base minor
 * units), or null when the currency has no rate today.
 */
export function valueInBase(board: RateBoard, money: Money): number | null {
  if (money.currency === board.base) {
    return money.amount;
  }
  const pair = board.rates[money.currency];
  if (!pair) return null;
  return toMinor(fromMinor(money.amount, money.currency).div(midRate(pair)), board.base);
}

/**
 * A base-currency amount (base minor units) in another currency at today's
 * mid rate (that currency's minor units), or null when it has no rate today.
 * The other way round from valueInBase.
 */
export function valueFromBase(board: RateBoard, baseAmount: number, to: CurrencyCode): number | null {
  if (to === board.base) {
    return baseAmount;
  }
  const pair = board.rates[to];
  if (!pair) return null;
  return toMinor(fromMinor(baseAmount, board.base).mul(midRate(pair)), to);
}

export interface DisplayRate {
  /** "129.5" */
  value: string;
  /** The currency the value is counted in: KES. */
  unit: CurrencyCode;
  /** Per one of this: USD. Reads "129.5 KES per USD". */
  per: CurrencyCode;
}

/**
 * A stored rate (out per in) the way people say it: always "big number per
 * one". 0.007663 KES->USD shows as 130.5 KES per USD.
 */
export function displayRate(rate: string, from: CurrencyCode, to: CurrencyCode): DisplayRate {
  const value = new Decimal(rate);
  if (value.gte(1)) {
    return { value: value.toDecimalPlaces(4).toString(), unit: to, per: from };
  }
  return { value: new Decimal(1).div(value).toDecimalPlaces(4).toString(), unit: from, per: to };
}
