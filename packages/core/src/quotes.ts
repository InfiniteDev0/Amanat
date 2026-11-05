import Decimal from 'decimal.js';

import type { CurrencyCode } from './currencies';
import { RATE_DECIMALS } from './rates';

// Rates the way the market says them: "1 USD = 129 KSh", "1 USD = 4,000 SOS".
//
// A sarrif never thinks "1 KSh = 0.0077 USD", whatever the shop counts its
// money in. So a rate is always typed, and stored (rates.units_per_usd), as
// units of the currency per 1 US dollar. The base currency is only for totals:
// the board (rates.ts, "units per 1 base unit") is worked out from these
// quotes whenever it's needed, never typed.
//
// Two non-dollar currencies (KSh and SOS) cross through the dollar:
// 1 KSh = 4,000 / 129 SOS.

/** What every rate is quoted against. */
export const QUOTE_CURRENCY = 'USD' satisfies CurrencyCode;

/** Units of each currency per 1 USD, as decimal strings. USD itself is never in it. */
export type UsdQuotes = Partial<Record<CurrencyCode, string>>;

/** Significant digits a worked-out board rate keeps: 1/129 needs far more than 6 decimals. */
const BOARD_DIGITS = 12;

/**
 * The currencies a shop types a rate for: every traded currency but the
 * dollar. None when it trades a single currency (nothing to convert).
 */
export function quotedCurrencies(currencies: readonly CurrencyCode[]): CurrencyCode[] {
  if (currencies.length < 2) return [];
  return currencies.filter((code) => code !== QUOTE_CURRENCY);
}

function perUsd(quotes: UsdQuotes, code: CurrencyCode): Decimal | null {
  if (code === QUOTE_CURRENCY) return new Decimal(1);
  const quote = quotes[code];
  if (!quote) return null;
  try {
    const value = new Decimal(quote);
    return value.gt(0) ? value : null;
  } catch {
    return null;
  }
}

/** A board rate as a plain string with no exponent and no trailing zeros. */
function plain(value: Decimal): string {
  return value.toSignificantDigits(BOARD_DIGITS, Decimal.ROUND_HALF_UP).toFixed();
}

/** A dollar quote as stored: numeric(20,6), so 3999.99999999 is 4000. */
function quote(value: Decimal): string {
  return value.toDecimalPlaces(RATE_DECIMALS, Decimal.ROUND_HALF_UP).toFixed();
}

/**
 * The board's rates (units of each currency per 1 base unit) from the dollar
 * quotes. A currency is left out when a quote it needs is missing: its own,
 * or the base's when the base isn't the dollar.
 */
export function boardRatesFromUsd(
  base: CurrencyCode,
  currencies: readonly CurrencyCode[],
  quotes: UsdQuotes,
): Partial<Record<CurrencyCode, string>> {
  const basePerUsd = perUsd(quotes, base);
  const rates: Partial<Record<CurrencyCode, string>> = {};
  if (!basePerUsd) return rates;
  for (const code of currencies) {
    if (code === base) continue;
    const codePerUsd = perUsd(quotes, code);
    if (codePerUsd) rates[code] = plain(codePerUsd.div(basePerUsd));
  }
  return rates;
}

/**
 * The other way: dollar quotes from board rates (units per 1 base unit).
 * Needs to know what the base is worth in dollars: 1 when the base is the
 * dollar, else from the board's own dollar rate, else `basePerUsd` (the
 * shop's last quote for its base). Null when none of those is known.
 */
export function usdQuotesFromBoard(
  base: CurrencyCode,
  boardRates: Partial<Record<CurrencyCode, string>>,
  basePerUsd?: string | null,
): UsdQuotes | null {
  let baseValue: Decimal | null = null;
  if (base === QUOTE_CURRENCY) baseValue = new Decimal(1);
  else if (boardRates[QUOTE_CURRENCY]) baseValue = new Decimal(1).div(boardRates[QUOTE_CURRENCY]!);
  else if (basePerUsd) baseValue = new Decimal(basePerUsd);
  if (!baseValue || !baseValue.gt(0)) return null;

  const quotes: UsdQuotes = {};
  if (base !== QUOTE_CURRENCY) quotes[base] = quote(baseValue);
  for (const [code, rate] of Object.entries(boardRates) as [CurrencyCode, string][]) {
    if (code === QUOTE_CURRENCY || code === base) continue;
    quotes[code] = quote(new Decimal(rate).times(baseValue));
  }
  return quotes;
}
