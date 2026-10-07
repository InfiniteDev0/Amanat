import { describe, expect, it } from 'vitest';

import { formatMoney, fromMinor, parseAmount, toMinor } from './money';

describe('toMinor / fromMinor', () => {
  it('stores 12.50 USD as 1250 cents and back', () => {
    expect(toMinor('12.5', 'USD')).toBe(1250);
    expect(fromMinor(1250, 'USD').toFixed(2)).toBe('12.50');
  });

  it('never picks up floating-point error', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in plain JS.
    expect(toMinor('0.1', 'USD') + toMinor('0.2', 'USD')).toBe(toMinor('0.3', 'USD'));
    expect(toMinor('1.005', 'USD')).toBe(101);
  });

  it('rejects a fractional stored amount', () => {
    expect(() => fromMinor(12.5, 'USD')).toThrow();
  });
});

describe('parseAmount', () => {
  it('reads what a cashier types', () => {
    expect(parseAmount('1,250.50', 'USD')).toBe(125050);
    expect(parseAmount(' 300 ', 'KES')).toBe(30000);
    expect(parseAmount('12 900', 'KES')).toBe(1290000);
  });

  it('reads Arabic-Indic digits', () => {
    expect(parseAmount('١٢٥٠', 'USD')).toBe(125000);
    expect(parseAmount('٣٫٥', 'USD')).toBe(350);
  });

  it('rejects junk, negatives and too many decimals', () => {
    expect(parseAmount('', 'USD')).toBeNull();
    expect(parseAmount('abc', 'USD')).toBeNull();
    expect(parseAmount('-5', 'USD')).toBeNull();
    expect(parseAmount('1.234', 'USD')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats with the currency code', () => {
    expect(formatMoney({ amount: 125050, currency: 'USD' })).toBe('1,250.50 USD');
  });

  it('keeps Latin digits in Arabic', () => {
    expect(formatMoney({ amount: 125050, currency: 'USD' }, { locale: 'ar' })).toMatch(/1.250.50 USD|1,250.50 USD|1٬250٫50 USD/);
    expect(formatMoney({ amount: 125050, currency: 'USD' }, { locale: 'ar' })).not.toMatch(/[٠-٩]/);
  });

  it('can sign money in and out', () => {
    expect(formatMoney({ amount: 500, currency: 'USD' }, { signed: true, showCurrency: false })).toBe('+5.00');
    expect(formatMoney({ amount: -500, currency: 'USD' }, { signed: true, showCurrency: false })).toBe('-5.00');
  });
});

describe('minor units follow ISO 4217', () => {
  it('stores yen and Ugandan shillings whole, dinars in thousandths', () => {
    expect(toMinor('1500', 'JPY')).toBe(1500);
    expect(toMinor('20000', 'UGX')).toBe(20000);
    expect(toMinor('1.250', 'KWD')).toBe(1250);
    expect(toMinor('12.5', 'SOS')).toBe(1250); // 2 by ISO, though browsers show none
  });
});
