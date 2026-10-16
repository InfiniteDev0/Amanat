import { describe, expect, it } from 'vitest';

import {
  accountKind,
  chargesOf,
  chargesSplit,
  chargesTotal,
  dealProfit,
  dealResult,
  dealSection,
  exchangeRowProfit,
  exchangeShillings,
  moveArrives,
  netOf,
  sallamAmounts,
} from './deals';
import type { RateBoard } from './rates';

// The client's examples (docs/Sarrif App – Profit forms.md, section 6). Today: 129.61 KSh per USD.
const board: RateBoard = { base: 'USD', rates: { KES: { buy: '129.61', sell: '129.61' } } };
const noRate: RateBoard = { base: 'USD', rates: {} };
const usd = (major: number) => Math.round(major * 100);
const kes = (major: number) => Math.round(major * 100);

describe('accountKind', () => {
  it('tells the four accounts apart', () => {
    expect(accountKind({ type: 'cash', currency: 'USD' })).toBe('cash_usd');
    expect(accountKind({ type: 'mobile_money', currency: 'USD' })).toBe('salaam_bank');
    expect(accountKind({ type: 'cash', currency: 'KES' })).toBe('cash_kes');
    expect(accountKind({ type: 'mobile_money', currency: 'KES' })).toBe('mpesa');
    expect(accountKind({ type: 'cash', currency: 'EUR' })).toBeNull();
  });
});

describe('Sallam', () => {
  it('sold 20,000 at 0.8%: Cash −20,000, Sallam +20,160, profit +160 $', () => {
    expect(sallamAmounts('sold', usd(20_000), '0.8')).toEqual({ cashOut: usd(20_000), sallamIn: usd(20_160), profit: { amount: usd(160), currency: 'USD' } });
  });

  it('bought 20,000 at 0.1%: Cash −20,000, Sallam +19,980, profit −20 $', () => {
    expect(sallamAmounts('bought', usd(20_000), '0.1')).toEqual({ cashOut: usd(20_000), sallamIn: usd(19_980), profit: { amount: usd(-20), currency: 'USD' } });
  });
});

describe('Exchange', () => {
  it('bought 100 $ at 127, today 129.61: KSh −12,700, profit +261 KSh', () => {
    expect(exchangeShillings(usd(100), '127')).toBe(kes(12_700));
    expect(exchangeRowProfit('bought', usd(100), '127', '129.61')).toEqual({ amount: kes(261), currency: 'KES' });
  });

  it('sold 200 $ at 129.80, today 129.61: KSh +25,960, profit +38 KSh', () => {
    expect(exchangeShillings(usd(200), '129.80')).toBe(kes(25_960));
    expect(exchangeRowProfit('sold', usd(200), '129.80', '129.61')).toEqual({ amount: kes(38), currency: 'KES' });
  });

  it("has no profit without today's rate", () => {
    expect(exchangeRowProfit('bought', usd(100), '127', null)).toBeNull();
  });
});

describe('Move', () => {
  it('1,500,000 M-Pesa into $ Cash at 129.40 arrives as 11,591.96 $ (no profit)', () => {
    // 1,500,000 ÷ 129.40 = 11,591.962… → 11,591.96
    expect(moveArrives(kes(1_500_000), 'KES', 'USD', '129.40')).toBe(usd(11_591.96));
  });

  it('moves the same amount within a currency, and needs the rate between currencies', () => {
    expect(moveArrives(usd(500), 'USD', 'USD')).toBe(usd(500));
    expect(moveArrives(usd(100), 'USD', 'KES', '129.40')).toBe(kes(12_940));
    expect(moveArrives(usd(100), 'USD', 'KES', null)).toBeNull();
  });
});

describe('saved rows', () => {
  // As stored: what came into one account, what went out of another.
  const sold = { amountIn: usd(20_160), currencyIn: 'USD' as const, amountOut: usd(20_000), currencyOut: 'USD' as const };
  const bought = { amountIn: usd(19_980), currencyIn: 'USD' as const, amountOut: usd(20_000), currencyOut: 'USD' as const };
  const boughtUsd = { amountIn: usd(100), currencyIn: 'USD' as const, amountOut: kes(12_700), currencyOut: 'KES' as const, todayRate: '129.61' };
  const soldUsd = { amountIn: kes(25_960), currencyIn: 'KES' as const, amountOut: usd(200), currencyOut: 'USD' as const, todayRate: '129.61' };

  it('read their profit, %, rate and list straight off the record', () => {
    expect(dealResult(sold)).toMatchObject({ profit: { amount: usd(160), currency: 'USD' }, percent: '0.8' });
    expect(dealResult(bought)).toMatchObject({ profit: { amount: usd(-20), currency: 'USD' }, percent: '-0.1' });
    expect(dealResult(boughtUsd)).toMatchObject({ profit: { amount: kes(261), currency: 'KES' }, rate: '127' });
    expect(dealResult(soldUsd)).toMatchObject({ profit: { amount: kes(38), currency: 'KES' }, rate: '129.8' });
    expect([sold, boughtUsd].map(dealSection)).toEqual(['sallam', 'exchange']);
  });

  it("keep their profit when today's rate changes later", () => {
    expect(dealProfit(boughtUsd, { base: 'USD', rates: { KES: { buy: '135', sell: '135' } } })).toEqual({ amount: kes(261), currency: 'KES' });
  });

  it('total as in the page example: profit +140 $ · +299 KSh, expenses 600 KSh, net +140 $ · −301 KSh ≈ +137.68 $', () => {
    const day = [sold, bought, boughtUsd, soldUsd];
    const profit = chargesOf(day, board);
    expect(profit).toEqual([
      { amount: usd(140), currency: 'USD' },
      { amount: kes(299), currency: 'KES' },
    ]);
    expect(chargesSplit(day, board)).toEqual({ swap: [{ amount: usd(140), currency: 'USD' }], exchange: [{ amount: kes(299), currency: 'KES' }] });
    const net = netOf(profit, [{ amount: kes(600), currency: 'KES' }]);
    expect(net).toEqual([
      { amount: usd(140), currency: 'USD' },
      { amount: kes(-301), currency: 'KES' },
    ]);
    // −301 / 129.61 = −2.3223… → −2.32; 140 − 2.32 = 137.68
    expect(chargesTotal(net, board)).toEqual({ amount: usd(137.68), currency: 'USD' });
    expect(chargesTotal(net, noRate)).toBeNull();
  });
});
