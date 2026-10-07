import Decimal from 'decimal.js';
import { z } from 'zod';

import { CURRENCY_CODES } from './currencies';
import { ACCOUNT_TYPES, EXPENSE_CATEGORIES, LANGUAGES } from './entities';

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
const positiveDecimal = (pattern: RegExp) =>
  z
    .string()
    .trim()
    .regex(pattern, 'validation.rate')
    .refine((value) => new Decimal(value).gt(0), 'validation.rate');
/** A board rate: numeric(18,6). */
const rate = positiveDecimal(/^\d+(\.\d{1,6})?$/);
/** An exchange's effective rate, out per in: numeric(24,10). */
const exchangeRate = positiveDecimal(/^\d+(\.\d{1,10})?$/);

// ── Auth and profile ─────────────────────────────────────────────────────────

/** E.164: + then 8–15 digits. The phone field builds this from country + number. */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'validation.phone');
export const otpSchema = z.string().regex(/^\d{6}$/, 'validation.otp');

export const sendCodeSchema = z.object({ phone: phoneSchema });
/** Trimmed and lower-cased, so the same address always matches. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('validation.email'));

export const profileSchema = z.object({
  name,
  language: z.enum(LANGUAGES),
  /** Left out = keep the current one. */
  email: emailSchema.optional(),
});
export const verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: otpSchema,
  /** From the Sign up tab. Saved only when the account is new; an existing account keeps its own. */
  profile: profileSchema.optional(),
});

/**
 * The Sign up tab of the auth page, checked in the browser before the code is
 * sent. Name and email reach the server through verifyCode's `profile`; the
 * currencies become the suggested currencies of their first shop (the first
 * one picked suggests the base currency).
 */
export const signUpSchema = z.object({
  firstName: name,
  email: emailSchema,
  phone: phoneSchema,
  currencies: z.array(currency).min(1, 'validation.currencies'),
  acceptTerms: z.literal(true, 'validation.terms'),
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

export const ratePairSchema = z
  .object({ currency, buy: rate, sell: rate })
  .refine((pair) => new Decimal(pair.buy).lte(pair.sell), { path: ['sell'], message: 'validation.buyAboveSell' });

export const setRatesSchema = z.object({
  date,
  rates: z.array(ratePairSchema).min(1, 'validation.rates'),
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
export type SendCodeInput = z.input<typeof sendCodeSchema>;
export type VerifyCodeInput = z.input<typeof verifyCodeSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type CreateWorkspaceInput = z.input<typeof createWorkspaceSchema>;
export type CreateAccountInput = z.input<typeof createAccountSchema>;
export type SetRatesInput = z.input<typeof setRatesSchema>;
export type CreateClientInput = z.input<typeof createClientSchema>;
export type CreateExchangeInput = z.input<typeof createExchangeSchema>;
export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type CreateAmanatInput = z.input<typeof createAmanatSchema>;
export type CreateDebtInput = z.input<typeof createDebtSchema>;
export type CreateDebtPaymentInput = z.input<typeof createDebtPaymentSchema>;
export type CreateTransferInput = z.input<typeof createTransferSchema>;
