import { describe, expect, it } from 'vitest';

import type { DailyRate } from './entities';
import { dailyNotificationId, hourIn, isNotificationKept, overdueRates } from './notifications';

const shop = { baseCurrency: 'USD' as const, currencies: ['USD' as const, 'KES' as const, 'SOS' as const], timeZone: 'Africa/Nairobi' };

const rate = (currency: 'KES' | 'SOS'): DailyRate => ({
  id: `r-${currency}`,
  workspaceId: 'ws',
  date: '2026-10-08',
  currency,
  buy: '129',
  sell: '130',
  setBy: 'u',
  setAt: '2026-10-08T05:00:00.000Z',
});

// Nairobi is UTC+3: 05:59Z is 08:59 there, 06:00Z is 09:00.
const before = new Date('2026-10-08T05:59:00Z');
const after = new Date('2026-10-08T06:00:00Z');

describe('hourIn', () => {
  it("reads the hour in the shop's time zone", () => {
    expect(hourIn('Africa/Nairobi', after)).toBe(9);
    expect(hourIn('UTC', after)).toBe(6);
  });
});

describe('overdueRates', () => {
  it('stays quiet before 9:00', () => {
    expect(overdueRates(shop, [], before)).toEqual([]);
  });

  it('lists the missing currencies from 9:00, never the base', () => {
    expect(overdueRates(shop, [], after)).toEqual(['KES', 'SOS']);
    expect(overdueRates(shop, [rate('KES')], after)).toEqual(['SOS']);
  });

  it('is empty once every rate is set', () => {
    expect(overdueRates(shop, [rate('KES'), rate('SOS')], after)).toEqual([]);
  });
});

describe('dailyNotificationId', () => {
  it('is the same for the same shop, day and person', () => {
    expect(dailyNotificationId('rates_not_set', 'ws', '2026-10-08', 'u')).toBe(dailyNotificationId('rates_not_set', 'ws', '2026-10-08', 'u'));
    expect(dailyNotificationId('rates_not_set', 'ws', '2026-10-08', 'u')).not.toBe(dailyNotificationId('rates_not_set', 'ws', '2026-10-09', 'u'));
  });
});

describe('isNotificationKept', () => {
  const at = new Date('2026-10-08T12:00:00Z');
  it('drops cleared ones', () => {
    expect(isNotificationKept({ clearedAt: '2026-10-08T11:00:00Z', createdAt: '2026-10-08T10:00:00Z' }, at)).toBe(false);
  });
  it('keeps 90 days, not 91', () => {
    expect(isNotificationKept({ clearedAt: null, createdAt: '2026-07-10T12:00:00Z' }, at)).toBe(true);
    expect(isNotificationKept({ clearedAt: null, createdAt: '2026-07-09T11:00:00Z' }, at)).toBe(false);
  });
});
