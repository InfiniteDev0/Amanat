import { describe, expect, it } from 'vitest';

import { signUpSchema, verifyCodeSchema } from './schemas';

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
