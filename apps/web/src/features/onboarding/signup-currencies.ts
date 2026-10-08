import { type CurrencyCode, isCurrencyCode } from '@sarrif/core';

// The currencies picked on the Sign up tab, carried to onboarding where they
// pre-fill the first shop's currencies (the first one suggests the base).
// Only a suggestion, so sessionStorage is enough: if it's gone, onboarding
// just asks.

const KEY = 'sarrif-signup-currencies';

export function saveSignupCurrencies(currencies: CurrencyCode[]) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(currencies));
  } catch {
    // Storage blocked (private mode): onboarding will ask instead.
  }
}

export function readSignupCurrencies(): CurrencyCode[] {
  try {
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter(isCurrencyCode) : [];
  } catch {
    return [];
  }
}

/** Once the shop exists the suggestion has done its job. */
export function clearSignupCurrencies() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
