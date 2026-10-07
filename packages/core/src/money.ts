import Decimal from 'decimal.js';

import { type CurrencyCode, getCurrency } from './currencies';

// Money is a whole number of the currency's smallest unit: $12.50 is 1250.
//
// In the database the column is bigint. In TypeScript it is a plain integer
// `number`, not a JS `bigint`: integers are exact up to 2^53 (90 trillion KES
// in cents), they survive JSON, and the Supabase client hands bigint columns
// back as numbers anyway. What is never allowed is a fraction: any maths that
// can produce one (rates, spreads, averages) goes through decimal.js and is
// rounded back to whole units here.
//
// Every amount travels with its currency. A bare number is a bug.

export interface Money {
  /** Whole smallest units (cents). Negative means money out. */
  amount: number;
  currency: CurrencyCode;
}

export class MoneyError extends Error {
  override name = 'MoneyError';
}

/** Throws unless `value` is a safe integer: the only valid stored amount. */
export function assertMinor(value: number, what = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${what} must be a whole number of minor units, got ${value}`);
  }
  return value;
}

function decimalsOf(currency: CurrencyCode): number {
  return getCurrency(currency).decimals;
}

/** A decimal amount ("12.5") to minor units (1250), rounded half-up to the currency's decimals. */
export function toMinor(value: Decimal.Value, currency: CurrencyCode): number {
  const minor = new Decimal(value)
    .times(new Decimal(10).pow(decimalsOf(currency)))
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return assertMinor(minor.toNumber());
}

/** Minor units (1250) back to an exact decimal (12.50). */
export function fromMinor(amount: number, currency: CurrencyCode): Decimal {
  return new Decimal(assertMinor(amount)).div(new Decimal(10).pow(decimalsOf(currency)));
}

/** Arabic-Indic (U+0660) and Extended Arabic-Indic (U+06F0) digits to 0-9. */
function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * What a cashier typed ("1,250.50", "١٢٥٠", " 300 ") to minor units, or null
 * when it isn't an amount. Commas, spaces and the Arabic thousands mark are
 * grouping; the Arabic decimal mark counts as a point. More decimals than the
 * currency allows is rejected rather than silently rounded.
 */
export function parseAmount(text: string, currency: CurrencyCode): number | null {
  const normalised = latinDigits(text)
    .replace(/[\s,٬]/g, '')
    .replace('٫', '.');
  if (!/^\d+(\.\d+)?$/.test(normalised)) {
    return null;
  }
  const fraction = normalised.split('.')[1] ?? '';
  if (fraction.length > decimalsOf(currency)) {
    return null;
  }
  try {
    return toMinor(normalised, currency);
  } catch {
    return null;
  }
}

/** Adds an amount into a per-currency running total. */
export function addTo(totals: Map<CurrencyCode, number>, money: Money): void {
  totals.set(money.currency, assertMinor((totals.get(money.currency) ?? 0) + money.amount, 'total'));
}

/** A per-currency total map as a stable, sorted list (for display and JSON). */
export function totalsToList(totals: Map<CurrencyCode, number>): Money[] {
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export interface FormatMoneyOptions {
  /** UI locale: 'en', 'so' or 'ar'. Digits stay Latin in every language. */
  locale?: string;
  /** Append the currency code: "1,250.50 USD". Default true. */
  showCurrency?: boolean;
  /** Show + on money in as well as − on money out. */
  signed?: boolean;
}

/**
 * "1,250.50 USD". Latin digits even in Arabic, so amounts read the same for
 * everyone; inside RTL text, render the result in a `dir="ltr"` element.
 */
export function formatMoney(money: Money, options: FormatMoneyOptions = {}): string {
  const { locale = 'en', showCurrency = true, signed = false } = options;
  const decimals = decimalsOf(money.currency);
  const formatter = new Intl.NumberFormat(`${locale}-u-nu-latn`, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
  });
  // Passing a string keeps every digit of very large amounts exact.
  const text = formatter.format(fromMinor(money.amount, money.currency).toFixed(decimals) as `${number}`);
  return showCurrency ? `${text} ${money.currency}` : text;
}
