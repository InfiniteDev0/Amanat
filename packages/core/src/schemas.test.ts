import { describe, expect, it } from 'vitest';

import { needsProfile } from './entities';
import {
  completeProfileSchema,
  createDealSchema,
  logInSchema,
  passwordSchema,
  profileSchema,
  ratePairSchema,
  signUpSchema,
  updateAccountSchema,
} from './schemas';

const signUp = {
  firstName: 'Amina',
  email: 'amina@example.com',
  password: 'sahan2026kes',
  acceptTerms: true,
  language: 'so',
} as const;

const firstIssue = (result: { error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe('signUpSchema', () => {
  it('accepts a complete sign-up', () => {
    expect(signUpSchema.parse(signUp)).toEqual(signUp);
  });

  it('trims names and rejects one letter', () => {
    expect(signUpSchema.parse({ ...signUp, firstName: '  Amina ' }).firstName).toBe('Amina');
    expect(firstIssue(signUpSchema.safeParse({ ...signUp, firstName: 'A' }))).toBe('validation.nameShort');
  });

  it('checks and normalises the email', () => {
    expect(signUpSchema.parse({ ...signUp, email: '  Amina@Example.COM ' }).email).toBe('amina@example.com');
    expect(firstIssue(signUpSchema.safeParse({ ...signUp, email: 'amina@' }))).toBe('validation.email');
  });

  it('has no phone: the setup wizard asks for it', () => {
    expect('phone' in signUpSchema.parse({ ...signUp, phone: '+254712345678' })).toBe(false);
  });

  it('requires the terms, with a translatable message', () => {
    expect(firstIssue(signUpSchema.safeParse({ ...signUp, acceptTerms: false }))).toBe('validation.terms');
  });

  it('refuses a weak password, like the server', () => {
    expect(firstIssue(signUpSchema.safeParse({ ...signUp, password: 'short1' }))).toBe('validation.passwordShort');
  });
});

describe('passwordSchema (the same rule as Supabase Auth: 8+, letters and digits)', () => {
  it.each(['sahan2026kes', 'Hoyo-iyo-aabo-7', 'كلمة سر 2026 قوية', 'abcdefghi1'])('accepts %j', (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(true);
  });

  it('needs at least 8 characters', () => {
    expect(firstIssue(passwordSchema.safeParse('abc123d'))).toBe('validation.passwordShort');
  });

  it('needs letters and digits', () => {
    expect(firstIssue(passwordSchema.safeParse('abcdefghijkl'))).toBe('validation.passwordWeak');
    expect(firstIssue(passwordSchema.safeParse('123456789012'))).toBe('validation.passwordWeak');
  });

  it('stops at 72 characters, where bcrypt stops reading', () => {
    expect(firstIssue(passwordSchema.safeParse('a1'.repeat(37)))).toBe('validation.passwordLong');
  });
});

describe('logInSchema', () => {
  it('checks only that a password was typed: the rule is for new passwords', () => {
    expect(logInSchema.safeParse({ email: 'amina@example.com', password: 'old-pass' }).success).toBe(true);
    expect(firstIssue(logInSchema.safeParse({ email: 'amina@example.com', password: '' }))).toBe('validation.passwordRequired');
  });
});

describe('completeProfileSchema and needsProfile', () => {
  it('takes the phone in E.164, and the terms when they are given', () => {
    expect(completeProfileSchema.safeParse({ phone: '+254712345678', acceptTerms: true }).success).toBe(true);
    expect(completeProfileSchema.safeParse({ phone: '+254712345678' }).success).toBe(true);
    expect(firstIssue(completeProfileSchema.safeParse({ phone: '0712345678' }))).toBe('validation.phone');
    expect(firstIssue(completeProfileSchema.safeParse({ phone: '+254712345678', acceptTerms: false }))).toBe('validation.terms');
  });

  it('knows who still has to complete it', () => {
    expect(needsProfile({ phone: '', termsAcceptedAt: null })).toBe(true);
    expect(needsProfile({ phone: '+254712345678', termsAcceptedAt: null })).toBe(true);
    expect(needsProfile({ phone: '+254712345678', termsAcceptedAt: '2026-10-20T08:00:00Z' })).toBe(false);
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

describe('createDealSchema', () => {
  it('takes a Sallam row: sold or bought, dollars, a %', () => {
    expect(createDealSchema.safeParse({ type: 'sallam', side: 'sold', amount: 2_000_000, percent: '0.8' }).success).toBe(true);
    expect(createDealSchema.safeParse({ type: 'sallam', side: 'bought', amount: 2_000_000, percent: '120' }).error?.issues[0]?.message).toBe('validation.percent');
  });

  it('takes an exchange row: bought or sold dollars at a rate, and its two accounts', () => {
    const row = { type: 'exchange', side: 'bought', amount: 10_000, rate: '127', usdAccountId: 'cash-usd', kesAccountId: 'cash-kes' };
    expect(createDealSchema.safeParse(row).success).toBe(true);
    expect(createDealSchema.safeParse({ ...row, rate: undefined }).success).toBe(false);
  });
});
