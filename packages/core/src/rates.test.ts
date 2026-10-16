import { describe, expect, it } from 'vitest';

import {
  displayRate,
  isValidRatePair,
  quoteByGet,
  quoteByGive,
  rateChange,
  type RateBoard,
  sharesInBase,
  valueFromBase,
  valueInBase,
  withReferenceRates,
} from './rates';

const board: RateBoard = {
  base: 'USD',
  rates: {
    KES: { buy: '129.00', sell: '130.50' },
    SOS: { buy: '570', sell: '575' },
  },
};

describe('quotes', () => {
  it('customer brings dollars: shop buys USD at the buy rate', () => {
    const quote = quoteByGive(board, { amount: 10000, currency: 'USD' }, 'KES');
    expect(quote?.amountOut).toEqual({ amount: 1290000, currency: 'KES' }); // 12,900.00 KES
  });

  it('customer wants dollars: shop sells USD at the sell rate', () => {
    const quote = quoteByGet(board, 'KES', { amount: 10000, currency: 'USD' });
    expect(quote?.amountIn).toEqual({ amount: 1305000, currency: 'KES' }); // 13,050.00 KES
  });

  it('cross pair goes through the base on both legs', () => {
    // 13,050 KES -> 100 USD (KES sell) -> 57,000 SOS (SOS buy)
    const quote = quoteByGive(board, { amount: 1305000, currency: 'KES' }, 'SOS');
    expect(quote?.amountOut).toEqual({ amount: 5700000, currency: 'SOS' });
  });

  it('give and get agree with each other', () => {
    const give = quoteByGive(board, { amount: 25000, currency: 'USD' }, 'KES')!;
    const get = quoteByGet(board, 'USD', give.amountOut)!;
    expect(get.amountIn).toEqual(give.amountIn);
  });

  it('returns null when a rate is missing or the currencies match', () => {
    expect(quoteByGive(board, { amount: 100, currency: 'USD' }, 'ETB')).toBeNull();
    expect(quoteByGive(board, { amount: 100, currency: 'USD' }, 'USD')).toBeNull();
  });
});

describe('valueInBase', () => {
  it('values at the mid rate', () => {
    // mid KES = 129.75; 12,975 KES = 100 USD
    expect(valueInBase(board, { amount: 1297500, currency: 'KES' })).toBe(10000);
    expect(valueInBase(board, { amount: 500, currency: 'USD' })).toBe(500);
    expect(valueInBase(board, { amount: 500, currency: 'ETB' })).toBeNull();
  });
});

describe('rate helpers', () => {
  it('rejects buy above sell', () => {
    expect(isValidRatePair({ buy: '129', sell: '130' })).toBe(true);
    expect(isValidRatePair({ buy: '131', sell: '130' })).toBe(false);
    expect(isValidRatePair({ buy: '0', sell: '130' })).toBe(false);
  });

  it('displays small rates the way people say them', () => {
    const quote = quoteByGet(board, 'KES', { amount: 10000, currency: 'USD' })!;
    expect(displayRate(quote.rate, 'KES', 'USD')).toEqual({ value: '130.5', unit: 'KES', per: 'USD' });
    expect(displayRate('129', 'USD', 'KES')).toEqual({ value: '129', unit: 'KES', per: 'USD' });
  });
});

describe('valueFromBase', () => {
  it('converts a base amount at the mid rate', () => {
    // 100.00 USD at KES mid 129.75 = 12,975.00 KES
    expect(valueFromBase(board, 10000, 'KES')).toBe(1297500);
  });

  it('leaves the base as it is and is null without a rate', () => {
    expect(valueFromBase(board, 10000, 'USD')).toBe(10000);
    expect(valueFromBase(board, 10000, 'EUR')).toBeNull();
  });
});

describe('withReferenceRates', () => {
  it('fills only the missing rates, at the reference rate both ways', () => {
    const filled = withReferenceRates(board, { base: 'USD', rates: { KES: '128', EUR: '0.9' } });
    expect(filled.rates.KES).toEqual({ buy: '129.00', sell: '130.50' });
    expect(filled.rates.EUR).toEqual({ buy: '0.9', sell: '0.9' });
    expect(board.rates.EUR).toBeUndefined();
  });

  it('ignores references against another base', () => {
    expect(withReferenceRates(board, { base: 'KES', rates: { EUR: '0.007' } })).toBe(board);
    expect(withReferenceRates(board, null)).toBe(board);
  });
});

describe('sharesInBase', () => {
  it('splits by value in the base', () => {
    // 100 USD and 129.75 x 100 KES (100 USD at mid): half each.
    const shares = sharesInBase(board, [
      { amount: 10000, currency: 'USD' },
      { amount: 1297500, currency: 'KES' },
    ]);
    expect(shares).toEqual([0.5, 0.5]);
  });

  it('counts below zero as nothing', () => {
    expect(sharesInBase(board, [{ amount: 10000, currency: 'USD' }, { amount: -500, currency: 'USD' }])).toEqual([1, 0]);
  });

  it('is all null without a rate or with nothing at all', () => {
    expect(sharesInBase(board, [{ amount: 100, currency: 'USD' }, { amount: 100, currency: 'EUR' }])).toEqual([null, null]);
    expect(sharesInBase(board, [{ amount: 0, currency: 'USD' }])).toEqual([null]);
  });
});

describe('rateChange', () => {
  const at = (rate: string): RateBoard => ({ base: 'USD', rates: { KES: { buy: rate, sell: rate } } });

  it('revalues the dollars held from yesterday to today in KSh', () => {
    // 45,000 USD, 129.00 → 129.61: worth 27,450 KSh more.
    expect(rateChange(4_500_000, at('129.00'), at('129.61'))).toEqual({ amount: 2_745_000, currency: 'KES' });
    // And less when the rate falls.
    expect(rateChange(4_500_000, at('129.61'), at('129.00'))).toEqual({ amount: -2_745_000, currency: 'KES' });
  });

  it('is unknown without either day\'s rate', () => {
    expect(rateChange(4_500_000, { base: 'USD', rates: {} }, at('129.61'))).toBeNull();
    expect(rateChange(4_500_000, at('129.00'), { base: 'USD', rates: {} })).toBeNull();
  });
});
