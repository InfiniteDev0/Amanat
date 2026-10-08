import { describe, expect, it } from 'vitest';

import { profileSchema, ratePairSchema, signUpSchema, updateAccountSchema, verifyCodeSchema } from './schemas';

const signUp = {
  firstName: 'Amina',
  email: 'amina@example.com',
  phone: '+254712345678',
  currencies: ['USD', 'KES'],
  acceptTerms: true,
} as const;

describe('signUpSchema', () => {
  it('accepts a complete sign-up', () => {
    expect(signUpSchema.parse(signUp)).toEqual(signUp);
  });

  it('trims names and rejects one letter', () => {
    expect(signUpSchema.parse({ ...signUp, firstName: '  Amina ' }).firstName).toBe('Amina');
    expect(signUpSchema.safeParse({ ...signUp, firstName: 'A' }).error?.issues[0]?.message).toBe('validation.nameShort');
  });

  it('checks and normalises the email', () => {
    expect(signUpSchema.parse({ ...signUp, email: '  Amina@Example.COM ' }).email).toBe('amina@example.com');
    expect(signUpSchema.safeParse({ ...signUp, email: 'amina@' }).error?.issues[0]?.message).toBe('validation.email');
  });

  it('requires the terms, with a translatable message', () => {
    const result = signUpSchema.safeParse({ ...signUp, acceptTerms: false });
    expect(result.error?.issues[0]?.message).toBe('validation.terms');
  });

  it('takes any ISO currency, at least one', () => {
    expect(signUpSchema.safeParse({ ...signUp, currencies: ['EUR', 'JPY'] }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...signUp, currencies: ['XYZ'] }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...signUp, currencies: [] }).error?.issues[0]?.message).toBe('validation.currencies');
  });
});

describe('verifyCodeSchema', () => {
  it('takes an optional profile from the Sign up tab', () => {
    expect(verifyCodeSchema.parse({ phone: '+254712345678', code: '123456' }).profile).toBeUndefined();
    const withProfile = verifyCodeSchema.parse({
      phone: '+254712345678',
      code: '123456',
      profile: { name: 'Amina', language: 'so', email: 'amina@example.com' },
    });
    expect(withProfile.profile).toEqual({ name: 'Amina', language: 'so', email: 'amina@example.com' });
  });
});

describe('profile photo', () => {
  const profile = { name: 'Amina', language: 'en' } as const;
  it('takes an https URL or a small image data URL, and null to remove it', () => {
    expect(profileSchema.safeParse({ ...profile, avatar: 'https://cdn.example.com/a.jpg' }).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile, avatar: 'data:image/jpeg;base64,AAAA' }).success).toBe(true);
    expect(profileSchema.parse({ ...profile, avatar: null }).avatar).toBeNull();
  });
  it('refuses anything else', () => {
    expect(profileSchema.safeParse({ ...profile, avatar: 'javascript:alert(1)' }).error?.issues[0]?.message).toBe('validation.photo');
    expect(profileSchema.safeParse({ ...profile, avatar: 'http://insecure.example.com/a.jpg' }).success).toBe(false);
  });
});

describe('rates typed by hand', () => {
  // Zod 4 keeps checking after a failed check; a typo must come back as a
  // validation message, never a crash.
  it.each(['129..', '1.2.3', 'abc', '.', '12,5', '-1', ''])('rejects %j without throwing', (typo) => {
    expect(() => ratePairSchema.safeParse({ currency: 'KES', buy: typo, sell: '130' })).not.toThrow();
    const result = ratePairSchema.safeParse({ currency: 'KES', buy: typo, sell: '130' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.rate');
  });

  it('still checks buy against sell when both are numbers', () => {
    expect(ratePairSchema.safeParse({ currency: 'KES', buy: '130', sell: '129' }).error?.issues[0]?.message).toBe(
      'validation.buyAboveSell',
    );
  });
});

describe('updateAccountSchema', () => {
  it('takes a whole number of minor units, zero or more', () => {
    expect(updateAccountSchema.safeParse({ openingBalance: 250000 }).success).toBe(true);
    expect(updateAccountSchema.safeParse({ openingBalance: 0 }).success).toBe(true);
  });

  it('refuses a negative or fractional amount', () => {
    expect(updateAccountSchema.safeParse({ openingBalance: -1 }).error?.issues[0]?.message).toBe('validation.amountPositive');
    expect(updateAccountSchema.safeParse({ openingBalance: 1.5 }).error?.issues[0]?.message).toBe('validation.amount');
  });
});
