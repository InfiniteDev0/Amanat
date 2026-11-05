import { describe, expect, it } from 'vitest';

import { boardRatesFromUsd, quotedCurrencies, usdQuotesFromBoard } from './quotes';

describe('quotedCurrencies', () => {
  it('asks for every traded currency but the dollar', () => {
    expect(quotedCurrencies(['KES', 'USD', 'SOS'])).toEqual(['KES', 'SOS']);
  });

  it('asks for the base too when it is not the dollar: "1 USD = 129 KSh"', () => {
    expect(quotedCurrencies(['KES', 'USD'])).toEqual(['KES']);
  });

  it('asks for nothing when the shop trades one currency', () => {
    expect(quotedCurrencies(['KES'])).toEqual([]);
    expect(quotedCurrencies(['USD'])).toEqual([]);
  });

  it('crosses through the dollar when the shop trades no dollars', () => {
    expect(quotedCurrencies(['KES', 'SOS'])).toEqual(['KES', 'SOS']);
  });
});

describe('boardRatesFromUsd', () => {
  it('base USD: the quotes are the board', () => {
    expect(boardRatesFromUsd('USD', ['USD', 'KES', 'SOS'], { KES: '129', SOS: '4000' })).toEqual({ KES: '129', SOS: '4000' });
  });

  it('base KSh: the dollar is 1/129 KSh, SOS crosses through the dollar', () => {
    const board = boardRatesFromUsd('KES', ['KES', 'USD', 'SOS'], { KES: '129', SOS: '4000' });
    expect(board.USD).toBe('0.0077519379845');
    expect(board.SOS).toBe('31.007751938');
    expect(board.KES).toBeUndefined();
  });

  it('leaves out what it cannot work out', () => {
    expect(boardRatesFromUsd('KES', ['KES', 'USD'], {})).toEqual({});
    expect(boardRatesFromUsd('USD', ['USD', 'KES', 'SOS'], { KES: '129' })).toEqual({ KES: '129' });
  });
});

describe('usdQuotesFromBoard', () => {
  it('base USD: the board is the quotes', () => {
    expect(usdQuotesFromBoard('USD', { KES: '129' })).toEqual({ KES: '129' });
  });

  it('base KSh: the board\'s dollar rate tells what a shilling is worth', () => {
    expect(usdQuotesFromBoard('KES', { USD: '0.0077519379845', SOS: '31.007751938' })).toEqual({ KES: '129', SOS: '4000' });
  });

  it('base KSh with no dollar on the board: the last known base quote', () => {
    expect(usdQuotesFromBoard('KES', { SOS: '31' }, '129')).toEqual({ KES: '129', SOS: '3999' });
  });

  it('null when what the base is worth is unknown', () => {
    expect(usdQuotesFromBoard('KES', { SOS: '31' })).toBeNull();
  });

  it('round trip: quotes → board → quotes', () => {
    const quotes = { KES: '129.5', SOS: '4000', ETB: '57.25' };
    const board = boardRatesFromUsd('KES', ['KES', 'USD', 'SOS', 'ETB'], quotes);
    expect(usdQuotesFromBoard('KES', board)).toEqual(quotes);
  });
});
