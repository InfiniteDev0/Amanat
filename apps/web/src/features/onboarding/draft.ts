import {
  type AccountType,
  addTo,
  type CurrencyCode,
  isCurrencyCode,
  type Language,
  type Money,
  parseAmount,
  quotedCurrencies,
  suggestedAccounts,
  totalsToList,
} from '@sarrif/core';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { DEFAULT_COUNTRY } from '@/features/auth/countries';
import type { PhoneInput } from '@/features/auth/schemas';

// Everything the wizard collects, kept as typed (strings for amounts and
// rates) until the last step turns it into an OnboardingInput. Pure functions
// only; the hook in use-onboarding-draft.ts owns state and storage.

export interface DraftAccount {
  /** A suggestion's key ("cash-USD"), or "custom-…" for one added by hand. */
  key: string;
  /** null = the suggested name, worded in the user's language when shown. */
  name: string | null;
  type: AccountType;
  currency: CurrencyCode;
  provider: string | null;
  /** Opening balance as typed; empty means 0. */
  opening: string;
  /** Suggestions can be switched off; custom ones are removed instead. */
  on: boolean;
  custom: boolean;
}

export interface OnboardingDraft {
  /** Whose draft this is: a different person in the same tab starts fresh. */
  userId: string;
  step: number;
  name: string;
  /** Small square JPEG data URL, or null for initials. */
  avatar: string | null;
  /** Contact data. Prefilled when they have one. */
  phone: PhoneInput;
  /** Google sign-ups haven't agreed to the terms yet: the first step asks (set from the user, never stored as theirs). */
  termsNeeded: boolean;
  acceptTerms: boolean;
  language: Language;
  shopName: string;
  location: string;
  currencies: CurrencyCode[];
  baseCurrency: CurrencyCode | null;
  accounts: DraftAccount[];
  /** Today's rates as typed, the market's way: "1 USD = [129] KSh" (units per 1 USD). */
  rates: Partial<Record<CurrencyCode, string>>;
}

export function initialDraft({
  userId,
  name,
  avatar,
  phone,
  termsNeeded,
  language,
}: {
  userId: string;
  name: string;
  avatar: string | null;
  /** E.164, or empty. */
  phone: string;
  termsNeeded: boolean;
  language: Language;
}): OnboardingDraft {
  return {
    userId,
    step: 0,
    name,
    avatar,
    phone: phoneInputOf(phone),
    termsNeeded,
    acceptTerms: false,
    language,
    shopName: '',
    location: '',
    currencies: [],
    baseCurrency: null,
    accounts: [],
    rates: {},
  };
}

/** A saved E.164 phone back into the field's country + number; empty starts on the default country. */
export function phoneInputOf(phone: string): PhoneInput {
  const parsed = phone ? parsePhoneNumberFromString(phone) : undefined;
  return parsed?.country ? { country: parsed.country, number: parsed.nationalNumber } : { country: DEFAULT_COUNTRY, number: '' };
}

/** The currencies that get a rate box: every traded one but the dollar ("1 USD = … KSh"). */
export function quotedOf(draft: Pick<OnboardingDraft, 'currencies'>): CurrencyCode[] {
  return quotedCurrencies(draft.currencies);
}

/**
 * New list of traded currencies. Keeps the base if it's still traded (else
 * the first one), keeps every account edit for currencies still traded, adds
 * the suggested accounts for new ones, and drops rates no longer needed.
 */
export function withCurrencies(draft: OnboardingDraft, currencies: CurrencyCode[]): OnboardingDraft {
  const baseCurrency =
    draft.baseCurrency && currencies.includes(draft.baseCurrency) ? draft.baseCurrency : (currencies[0] ?? null);
  const traded = (account: DraftAccount) => currencies.includes(account.currency);
  const suggested = suggestedAccounts(currencies).map(
    (suggestion) =>
      draft.accounts.find((account) => account.key === suggestion.key) ?? {
        ...suggestion,
        name: null,
        opening: '',
        on: true,
        custom: false,
      },
  );
  const custom = draft.accounts.filter((account) => account.custom && traded(account));
  const quoted = quotedCurrencies(currencies);
  const rates = Object.fromEntries(
    Object.entries(draft.rates).filter(([code]) => quoted.includes(code as CurrencyCode)),
  ) as OnboardingDraft['rates'];
  return { ...draft, currencies, baseCurrency, accounts: [...suggested, ...custom], rates };
}

/** A new base currency: only for totals, so the rates stay as typed. */
export function withBase(draft: OnboardingDraft, baseCurrency: CurrencyCode | null): OnboardingDraft {
  return { ...draft, baseCurrency };
}

export function updateAccount(draft: OnboardingDraft, key: string, patch: Partial<DraftAccount>): OnboardingDraft {
  return { ...draft, accounts: draft.accounts.map((account) => (account.key === key ? { ...account, ...patch } : account)) };
}

/** The kept accounts' opening amounts added up per currency (what isn't a number yet counts as 0). */
export function openingTotals(accounts: readonly DraftAccount[]): Money[] {
  const totals = new Map<CurrencyCode, number>();
  for (const account of accounts) {
    if (!account.on) continue;
    addTo(totals, { amount: parseAmount(account.opening || '0', account.currency) ?? 0, currency: account.currency });
  }
  return totalsToList(totals);
}

/**
 * A saved draft (this tab's, or the one kept on the profile) back into a
 * draft, or null when it isn't this person's or isn't one. Anything missing
 * or of another shape (an older version of the wizard) starts empty.
 */
export function restoreDraft(saved: unknown, userId: string): OnboardingDraft | null {
  if (!saved || typeof saved !== 'object') return null;
  const draft = saved as Partial<OnboardingDraft>;
  if (draft.userId !== userId || !Array.isArray(draft.currencies)) return null;
  const currencies = draft.currencies.filter(isCurrencyCode);
  const rates = Object.fromEntries(
    Object.entries(draft.rates ?? {}).filter(([code, value]) => isCurrencyCode(code) && typeof value === 'string'),
  ) as OnboardingDraft['rates'];
  return {
    userId,
    step: typeof draft.step === 'number' ? draft.step : 0,
    name: draft.name ?? '',
    avatar: draft.avatar ?? null,
    phone: draft.phone ?? phoneInputOf(''),
    termsNeeded: false,
    acceptTerms: draft.acceptTerms ?? false,
    language: draft.language ?? 'so',
    shopName: draft.shopName ?? '',
    location: draft.location ?? '',
    currencies,
    baseCurrency: draft.baseCurrency && currencies.includes(draft.baseCurrency) ? draft.baseCurrency : (currencies[0] ?? null),
    accounts: Array.isArray(draft.accounts) ? draft.accounts.filter((account) => currencies.includes(account.currency)) : [],
    rates,
  };
}

/** What's kept on the profile between steps: the draft without the photo (too big; it stays in this tab). */
export function progressOf(draft: OnboardingDraft): { step: number; data: Record<string, unknown> } {
  const { avatar: _photo, termsNeeded: _owed, ...data } = draft;
  return { step: draft.step, data };
}

// ── This tab's copy ─────────────────────────────────────────────────────────
// sessionStorage: survives a refresh and the language switch (which reloads
// the page in the new locale) at once, before the profile's copy is read.

const KEY = 'sarrif-onboarding-draft';

export function loadDraft(userId: string): OnboardingDraft | null {
  try {
    return restoreDraft(JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null'), userId);
  } catch {
    return null;
  }
}

export function saveDraft(draft: OnboardingDraft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the profile's copy still lets it resume.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
