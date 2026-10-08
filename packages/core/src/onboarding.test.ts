import { describe, expect, it } from 'vitest';

import { suggestedAccounts } from './onboarding';
import { onboardingSchema } from './schemas';

describe('suggestedAccounts', () => {
  it('suggests cash for each currency and M-Pesa for shillings', () => {
    expect(suggestedAccounts(['USD', 'KES']).map((a) => a.key)).toEqual(['cash-USD', 'cash-KES', 'mobile-KES']);
    expect(suggestedAccounts(['USD', 'SOS']).every((a) => a.type === 'cash')).toBe(true);
  });
});

describe('onboardingSchema', () => {
  const setup = {
    profile: { name: 'Amina', language: 'so' },
    shop: { name: 'Eastleigh', baseCurrency: 'USD', currencies: ['USD', 'KES'] },
    accounts: [{ name: 'Cash USD', type: 'cash', currency: 'USD', openingBalance: 100000 }],
    rates: [{ currency: 'KES', buy: '129.2', sell: '129.8' }],
  } as const;

  it('accepts a complete setup, and rates can be skipped', () => {
    expect(onboardingSchema.safeParse(setup).success).toBe(true);
    expect(onboardingSchema.parse({ ...setup, rates: undefined }).rates).toEqual([]);
  });

  it('needs at least one account', () => {
    expect(onboardingSchema.safeParse({ ...setup, accounts: [] }).error?.issues[0]?.message).toBe('validation.accounts');
  });

  it('rejects an account or a rate in a currency the shop does not trade', () => {
    const euroAccount = { ...setup, accounts: [{ ...setup.accounts[0], currency: 'EUR' }] };
    expect(onboardingSchema.safeParse(euroAccount).error?.issues[0]?.path).toEqual(['accounts', 0, 'currency']);
    // The base currency has no rate: it's what the others are priced in.
    const baseRate = { ...setup, rates: [{ currency: 'USD', buy: '1', sell: '1' }] };
    expect(onboardingSchema.safeParse(baseRate).error?.issues[0]?.path).toEqual(['rates', 0, 'currency']);
  });
});
