import { describe, expect, it } from 'vitest';

import { suggestedAccounts } from './onboarding';
import { onboardingSchema } from './schemas';

describe('suggestedAccounts', () => {
  it('suggests the four places: $ Cash, $ Sallam, KSh Cash, M-Pesa', () => {
    expect(suggestedAccounts(['USD', 'KES']).map((a) => a.key)).toEqual(['cash-USD', 'sallam-USD', 'cash-KES', 'mobile-KES']);
    expect(suggestedAccounts(['USD']).find((a) => a.key === 'sallam-USD')).toMatchObject({ type: 'bank', provider: 'Sallam' });
  });

  it('suggests cash for any other currency', () => {
    expect(suggestedAccounts(['SOS', 'ETB']).every((a) => a.type === 'cash')).toBe(true);
  });
});

describe('onboardingSchema', () => {
  const setup = {
    profile: { name: 'Amina', language: 'so', phone: '+254712345678' },
    shop: { name: 'Eastleigh', baseCurrency: 'KES', currencies: ['KES', 'USD'] },
    accounts: [{ name: 'Cash USD', type: 'cash', currency: 'USD', openingBalance: 100000 }],
    // The market's direction even though the base is KSh: 1 USD = 129 KSh.
    rates: [{ currency: 'KES', perUsd: '129' }],
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
    // The dollar has no rate: it's what the others are quoted in.
    const dollarRate = { ...setup, rates: [{ currency: 'USD', perUsd: '1' }] };
    expect(onboardingSchema.safeParse(dollarRate).error?.issues[0]?.path).toEqual(['rates', 0, 'currency']);
    const notTraded = { ...setup, rates: [{ currency: 'SOS', perUsd: '4000' }] };
    expect(onboardingSchema.safeParse(notTraded).error?.issues[0]?.path).toEqual(['rates', 0, 'currency']);
  });

  it('needs the phone; the terms only when given', () => {
    const noPhone = { ...setup, profile: { name: 'Amina', language: 'so' } };
    expect(onboardingSchema.safeParse(noPhone).success).toBe(false);
    const terms = { ...setup, profile: { ...setup.profile, acceptTerms: true } };
    expect(onboardingSchema.safeParse(terms).success).toBe(true);
  });
});
