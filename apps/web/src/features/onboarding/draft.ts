import { type AccountType, type CurrencyCode, isCurrencyCode, type Language, suggestedAccounts } from '@sarrif/core';

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

export interface DraftRate {
  buy: string;
  sell: string;
}

export interface OnboardingDraft {
  /** Whose draft this is: a different person in the same tab starts fresh. */
  userId: string;
  step: number;
  name: string;
  /** Small square JPEG data URL, or null for initials. */
  avatar: string | null;
  language: Language;
  shopName: string;
  location: string;
  currencies: CurrencyCode[];
  baseCurrency: CurrencyCode | null;
  accounts: DraftAccount[];
  rates: Partial<Record<CurrencyCode, DraftRate>>;
}

export function initialDraft({
  userId,
  name,
  avatar,
  language,
  currencies,
}: {
  userId: string;
  name: string;
  avatar: string | null;
  language: Language;
  currencies: CurrencyCode[];
}): OnboardingDraft {
  const empty: OnboardingDraft = {
    userId,
    step: 0,
    name,
    avatar,
    language,
    shopName: '',
    location: '',
    currencies: [],
    baseCurrency: null,
    accounts: [],
    rates: {},
  };
  return withCurrencies(empty, currencies);
}

/** The currencies a shop prices against its base: the ones that need a rate. */
export function ratedOf(draft: Pick<OnboardingDraft, 'currencies' | 'baseCurrency'>): CurrencyCode[] {
  return draft.currencies.filter((code) => code !== draft.baseCurrency);
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
  return withBase({ ...draft, currencies, baseCurrency, accounts: [...suggested, ...custom] }, baseCurrency);
}

/** A new base currency; its own rate goes, since it's what the others are priced in. */
export function withBase(draft: OnboardingDraft, baseCurrency: CurrencyCode | null): OnboardingDraft {
  const rated = ratedOf({ currencies: draft.currencies, baseCurrency });
  const rates = Object.fromEntries(
    Object.entries(draft.rates).filter(([code]) => rated.includes(code as CurrencyCode)),
  ) as OnboardingDraft['rates'];
  return { ...draft, baseCurrency, rates };
}

export function updateAccount(draft: OnboardingDraft, key: string, patch: Partial<DraftAccount>): OnboardingDraft {
  return { ...draft, accounts: draft.accounts.map((account) => (account.key === key ? { ...account, ...patch } : account)) };
}

// ── Storage ─────────────────────────────────────────────────────────────────
// sessionStorage: survives a refresh and the language switch (which reloads
// the page in the new locale), and goes away with the tab.

const KEY = 'sarrif-onboarding-draft';

export function loadDraft(userId: string): OnboardingDraft | null {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as OnboardingDraft | null;
    if (!saved || saved.userId !== userId || !Array.isArray(saved.currencies)) return null;
    return { ...saved, avatar: saved.avatar ?? null, currencies: saved.currencies.filter(isCurrencyCode) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: OnboardingDraft) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Storage blocked: the wizard still works, it just won't survive a reload.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
