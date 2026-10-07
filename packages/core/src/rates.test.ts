import { describe, expect, it } from 'vitest';

import { displayRate, isValidRatePair, quoteByGet, quoteByGive, type RateBoard, valueInBase } from './rates';

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
