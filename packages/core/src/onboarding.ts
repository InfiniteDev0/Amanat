import type { CurrencyCode } from './currencies';
import type { AccountType } from './entities';

// First-run setup rules shared by the wizard and the backend. The client's
// shop has four places for money (Build Plan v4): $ Cash, $ Sallam, KSh Cash
// and M-Pesa, so those are suggested, with cash for any other currency.
// Names are left to the UI so they come out in the user's language; `key`
// identifies a suggestion across re-renders and edits.

export interface SuggestedAccount {
  key: string;
  type: AccountType;
  currency: CurrencyCode;
  /** Mobile money / bank brand; null for cash. */
  provider: string | null;
}

/** Besides cash, the place each currency is usually kept: Sallam for dollars, M-Pesa for shillings. */
const OTHER_PLACE: Partial<Record<CurrencyCode, { type: AccountType; provider: string; key: string }>> = {
  USD: { type: 'bank', provider: 'Sallam', key: 'sallam' },
  KES: { type: 'mobile_money', provider: 'M-Pesa', key: 'mobile' },
};

/** Per traded currency, in order: its cash, then its usual other place ($ Cash, $ Sallam, KSh Cash, M-Pesa). */
export function suggestedAccounts(currencies: readonly CurrencyCode[]): SuggestedAccount[] {
  return currencies.flatMap((currency) => {
    const cash: SuggestedAccount = { key: `cash-${currency}`, type: 'cash', currency, provider: null };
    const other = OTHER_PLACE[currency];
    return other ? [cash, { key: `${other.key}-${currency}`, type: other.type, currency, provider: other.provider }] : [cash];
  });
}
