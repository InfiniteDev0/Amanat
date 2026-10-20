import Decimal from 'decimal.js';
import { z } from 'zod';

import { CURRENCY_CODES } from './currencies';
import { EXCHANGE_SIDES, SALLAM_SIDES } from './deals';
import { ACCOUNT_TYPES, EXPENSE_CATEGORIES, LANGUAGES, ROLES } from './entities';

// What the API accepts, checked the same way in the browser (instant form
// feedback) and on the server (the real gate). Amounts arrive as minor units:
// forms turn "1,250.50" into 125050 with `parseAmount` before validating.
//
// Error messages are translation keys under `validation.*`, so the form shows
// them in the user's language.

const id = z.string().min(1);
const currency = z.enum(CURRENCY_CODES);
/** A positive whole number of minor units. */
const amount = z.int('validation.amount').positive('validation.amountPositive');
const name = z.string().trim().min(2, 'validation.nameShort').max(80, 'validation.nameLong');
const note = z
  .string()
  .trim()
  .max(500, 'validation.noteLong')
  .nullish()
  .transform((value) => value || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date');
/**
 * Typed text as a Decimal, or null when it isn't a number ("129..").
 * Zod 4 runs every check even after one fails, so a check must never assume
 * an earlier one passed: `new Decimal` throws on bad input.
 */
function toDecimal(value: string): Decimal | null {
  try {
    return new Decimal(value);
  } catch {
    return null;
  }
}
const positiveDecimal = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .regex(pattern, { message: 'validation.rate', abort: true })
    .refine((value) => toDecimal(value)?.gt(0) ?? false, 'validation.rate');
/** A board rate: numeric(18,6). */
const rate = positiveDecimal(/^\d+(\.\d{1,6})?$/);
/** An exchange's effective rate, out per in: numeric(24,10). */
const exchangeRate = positiveDecimal(/^\d+(\.\d{1,10})?$/);

// ── Auth and profile ─────────────────────────────────────────────────────────

/**
 * E.164: + then 8–15 digits. The phone field builds this from country + number.
 * Contact data only: nobody signs in with it (Phase 1b).
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'validation.phone');

/** Trimmed and lower-cased, so the same address always matches. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('validation.email'));

/**
 * Which Terms and Risk statements (docs/legal) someone agrees to. Bump it when
 * they change, so the profile records which version each person accepted.
 */
export const TERMS_VERSION = '2026-10-20';

/** The password rule, the same as Supabase Auth's settings (supabase/config.toml), so the form can't be bypassed. */
export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt, under Supabase Auth, reads only the first 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, 'validation.passwordShort')
  .max(PASSWORD_MAX_LENGTH, 'validation.passwordLong')
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), 'validation.passwordWeak');

export const profileSchema = z.object({
  name,
  language: z.enum(LANGUAGES),
  /** Left out = keep the current one. */
  email: emailSchema.optional(),
  /** A photo URL or a small image data URL (~256px JPEG); null removes it, left out keeps it. */
  avatar: z
    .string()
    .max(300_000, 'validation.photoTooBig')
    .refine((value) => /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/.test(value), 'validation.photo')
    .nullish(),
});
/**
 * The Sign up tab: email + password to sign in, the name, and the terms
 * (agreed before the account exists). The phone comes later, in the setup
 * wizard. `language` is the page's, so the confirmation email's link brings
 * them back to it.
 */
export const signUpSchema = z.object({
  firstName: name,
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, 'validation.terms'),
  language: z.enum(LANGUAGES),
});

/** The Log in tab. Any password is checked by the server, which answers the same for a wrong password or an unknown email. */
export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.passwordRequired').max(PASSWORD_MAX_LENGTH, 'validation.passwordLong'),
});

/** Forgot password, and Send the email again: where to send it, and the language to come back in. */
export const emailLinkSchema = z.object({ email: emailSchema, language: z.enum(LANGUAGES) });

export const googleSignInSchema = z.object({ language: z.enum(LANGUAGES) });

/** After the reset link: the new password. */
export const newPasswordSchema = z.object({ password: passwordSchema });

/**
 * The phone (contact data), and the terms for anyone who hasn't agreed yet
 * (Google sign-ups): from the setup wizard's first step, or from Complete
 * your profile for people invited to a shop, who skip the wizard. Left out,
 * the terms already agreed stay as they are.
 */
export const completeProfileSchema = z.object({
  phone: phoneSchema,
  acceptTerms: z.literal(true, 'validation.terms').optional(),
});

// ── Shop setup ───────────────────────────────────────────────────────────────

export const createWorkspaceSchema = z
  .object({
    name,
    location: z.string().trim().max(120).default(''),
    baseCurrency: currency,
    currencies: z.array(currency).min(1, 'validation.currencies'),
    timeZone: z.string().default('Africa/Nairobi'),
  })
  .refine((shop) => shop.currencies.includes(shop.baseCurrency), {
    path: ['currencies'],
    message: 'validation.baseNotTraded',
  });

export const createAccountSchema = z.object({
  name,
  type: z.enum(ACCOUNT_TYPES),
  currency,
  provider: z.string().trim().max(60).nullish().transform((value) => value || null),
  openingBalance: z.int('validation.amount').min(0, 'validation.amountPositive').default(0),
  minimumBalance: z.int('validation.amount').min(0).nullable().default(null),
});

/** What an Owner can change on an account: so far, the money it started with. */
export const updateAccountSchema = z.object({
  openingBalance: z.int('validation.amount').min(0, 'validation.amountPositive'),
});

export const ratePairSchema = z
  .object({ currency, buy: rate, sell: rate })
  .refine(
    (pair) => {
      // A rate that isn't a number is already reported on its own field.
      const buy = toDecimal(pair.buy);
      const sell = toDecimal(pair.sell);
      return !buy || !sell || buy.lte(sell);
    },
    { path: ['sell'], message: 'validation.buyAboveSell' },
  );

export const setRatesSchema = z.object({
  date,
  rates: z.array(ratePairSchema).min(1, 'validation.rates'),
});

/**
 * The whole first-run setup, saved in one go (one transaction on the real
 * backend), so a failure never leaves half a shop behind: the profile, the
 * shop (the caller becomes its Owner), its accounts and, unless skipped,
 * today's rates. Today's date comes from the shop's time zone on the server.
 */
export const onboardingSchema = z
  .object({
    profile: profileSchema,
    shop: createWorkspaceSchema,
    accounts: z.array(createAccountSchema).min(1, 'validation.accounts'),
    rates: z.array(ratePairSchema).default([]),
  })
  .superRefine(({ shop, accounts, rates }, ctx) => {
    accounts.forEach((account, index) => {
      if (!shop.currencies.includes(account.currency)) {
        ctx.addIssue({ code: 'custom', path: ['accounts', index, 'currency'], message: 'validation.currencies' });
      }
    });
    const rated = shop.currencies.filter((code) => code !== shop.baseCurrency);
    rates.forEach((pair, index) => {
      if (!rated.includes(pair.currency)) {
        ctx.addIssue({ code: 'custom', path: ['rates', index, 'currency'], message: 'validation.currencies' });
      }
    });
  });

export const createClientSchema = z.object({
  name,
  phone: phoneSchema.nullish().transform((value) => value || null),
  notes: note,
});

// ── The five "+ New" records ─────────────────────────────────────────────────

export const createExchangeSchema = z
  .object({
    currencyIn: currency,
    amountIn: amount,
    accountIn: id,
    currencyOut: currency,
    amountOut: amount,
    accountOut: id,
    rate: exchangeRate,
    clientId: id.nullish().transform((value) => value ?? null),
    note,
  })
  .refine((exchange) => exchange.currencyIn !== exchange.currencyOut, {
    path: ['currencyOut'],
    message: 'validation.sameCurrency',
  });

/** A Sallam percentage: more than 0, at most 100, up to 4 decimals. */
const percent = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, { message: 'validation.percent', abort: true })
  .refine((value) => {
    const share = toDecimal(value);
    return Boolean(share && share.gt(0) && share.lte(100));
  }, 'validation.percent');

const customer = z.string().trim().max(80, 'validation.nameLong').nullish().transform((value) => value || null);

/**
 * A profit row (deals.ts): Sallam (sold / bought, dollars and a %) or an
 * exchange (bought / sold dollars at a rate, and which dollar and shilling
 * accounts). The backend works out the rest.
 */
export const createDealSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('sallam'), side: z.enum(SALLAM_SIDES), amount, percent, customer, note }),
  z.object({
    type: z.literal('exchange'),
    side: z.enum(EXCHANGE_SIDES),
    amount,
    rate,
    usdAccountId: id,
    kesAccountId: id,
    customer,
    note,
  }),
]);

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount,
  currency,
  accountId: id,
  note,
});

export const createAmanatSchema = z.object({
  clientId: id,
  type: z.enum(['deposit', 'withdrawal']),
  amount,
  currency,
  accountId: id,
  note,
});

/** Holding money for a client: who, which account it sits in, how much (in that account's currency). */
export const holdAmanatSchema = z.object({
  clientName: z.string().trim().min(2, 'validation.nameShort').max(80, 'validation.nameLong'),
  accountId: id,
  amount,
  note,
});

/** Close day: each account's count; a note wherever the count is off (checked against what's expected). */
export const closeDaySchema = z.object({
  date,
  counts: z
    .array(
      z.object({
        accountId: id,
        counted: z.int('validation.amount').min(0, 'validation.amount'),
        note,
      }),
    )
    .min(1, 'validation.accounts'),
});

/** An Owner opens a closed day again, saying why (it's logged). */
export const reopenDaySchema = z.object({
  date,
  reason: z.string().trim().min(3, 'validation.reason').max(500, 'validation.noteLong'),
});

/** Invite someone to the shop: their phone and what they may do. */
export const inviteSchema = z.object({
  phone: phoneSchema,
  role: z.enum(ROLES),
});

/** What an Owner changes in Settings. */
export const updateWorkspaceSchema = z.object({
  name,
  location: z.string().trim().max(120).default(''),
  closingTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.time'),
  largeTransactionLimit: z.int('validation.amount').min(0, 'validation.amount'),
});

export const createDebtSchema = z.object({
  clientId: id,
  direction: z.enum(['they_owe_us', 'we_owe_them']),
  amount,
  currency,
  dueDate: date.nullish().transform((value) => value ?? null),
  note,
});

export const createDebtPaymentSchema = z.object({
  debtId: id,
  amount,
  accountId: id,
});

export const createTransferSchema = z
  .object({
    fromAccountId: id,
    toAccountId: id,
    toWorkspaceId: id.nullish().transform((value) => value ?? null),
    amountOut: amount,
    amountIn: amount,
    fee: z.int('validation.amount').min(0).default(0),
    note,
  })
  .refine((transfer) => transfer.fromAccountId !== transfer.toAccountId, {
    path: ['toAccountId'],
    message: 'validation.sameAccount',
  });

// What callers pass (defaults optional) — the API parses it into the full shape.
export type SignUpInput = z.input<typeof signUpSchema>;
export type LogInInput = z.input<typeof logInSchema>;
export type EmailLinkInput = z.input<typeof emailLinkSchema>;
export type GoogleSignInInput = z.input<typeof googleSignInSchema>;
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
export type CompleteProfileInput = z.input<typeof completeProfileSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type CreateWorkspaceInput = z.input<typeof createWorkspaceSchema>;
export type CreateAccountInput = z.input<typeof createAccountSchema>;
export type UpdateAccountInput = z.input<typeof updateAccountSchema>;
export type SetRatesInput = z.input<typeof setRatesSchema>;
export type CreateClientInput = z.input<typeof createClientSchema>;
export type OnboardingInput = z.input<typeof onboardingSchema>;
export type CreateExchangeInput = z.input<typeof createExchangeSchema>;
export type CreateDealInput = z.input<typeof createDealSchema>;
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateAmanatInput = z.input<typeof createAmanatSchema>;
export type HoldAmanatInput = z.input<typeof holdAmanatSchema>;
export type CloseDayInput = z.input<typeof closeDaySchema>;
export type ReopenDayInput = z.input<typeof reopenDaySchema>;
export type InviteInput = z.input<typeof inviteSchema>;
export type UpdateWorkspaceInput = z.input<typeof updateWorkspaceSchema>;
export type CreateDebtInput = z.input<typeof createDebtSchema>;
export type CreateDebtPaymentInput = z.input<typeof createDebtPaymentSchema>;
export type CreateTransferInput = z.input<typeof createTransferSchema>;
