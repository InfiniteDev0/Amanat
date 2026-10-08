import type { CurrencyCode } from './currencies';
import type { AccountType } from './entities';

// First-run setup rules shared by the wizard and the backend. The spec:
// "Add accounts with opening balances (suggested: Cash for each currency,
// M-Pesa KES)". Names are left to the UI so they come out in the user's
// language; `key` identifies a suggestion across re-renders and edits.

export interface SuggestedAccount {
  key: string;
  type: AccountType;
  currency: CurrencyCode;
  /** Mobile money / bank brand; null for cash. */
  provider: string | null;
}

/** Mobile-money wallets worth suggesting per currency. Only M-Pesa is in the spec so far. */
const MOBILE_MONEY: Partial<Record<CurrencyCode, string>> = {
  KES: 'M-Pesa',
};

/** Cash for each traded currency, then the known mobile-money wallet for each. */
export function suggestedAccounts(currencies: readonly CurrencyCode[]): SuggestedAccount[] {
  const cash = currencies.map((currency) => ({ key: `cash-${currency}`, type: 'cash' as const, currency, provider: null }));
  const mobile = currencies.flatMap((currency) => {
    const provider = MOBILE_MONEY[currency];
    return provider ? [{ key: `mobile-${currency}`, type: 'mobile_money' as const, currency, provider }] : [];
  });
  return [...cash, ...mobile];
}
