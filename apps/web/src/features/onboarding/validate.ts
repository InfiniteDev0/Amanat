import { parseAmount, profileSchema, ratePairSchema } from '@sarrif/core';

import { type OnboardingDraft, ratedOf } from './draft';

/** The first thing wrong on a step: which field, and a `validation.*` key. */
export interface StepProblem {
  field: string;
  message: string;
}

const NAME = profileSchema.shape.name;

/** Empty says what's missing; filled gets core's rule (too short, too long). */
function checkName(value: string, field: string, required: string): StepProblem | null {
  if (!value.trim()) return { field, message: required };
  const result = NAME.safeParse(value);
  return result.success ? null : { field, message: result.error.issues[0]?.message ?? 'validation.nameShort' };
}

export function validateProfile(draft: OnboardingDraft): StepProblem | null {
  return checkName(draft.name, 'name', 'validation.nameRequired');
}

export function validateShop(draft: OnboardingDraft): StepProblem | null {
  return checkName(draft.shopName, 'shopName', 'validation.shopNameRequired');
}

export function validateCurrencies(draft: OnboardingDraft): StepProblem | null {
  if (draft.currencies.length === 0) return { field: 'currencies', message: 'validation.currencies' };
  if (!draft.baseCurrency) return { field: 'base', message: 'validation.baseRequired' };
  return null;
}

export function validateAccounts(draft: OnboardingDraft): StepProblem | null {
  const kept = draft.accounts.filter((account) => account.on);
  if (kept.length === 0) return { field: 'accounts', message: 'validation.accounts' };
  for (const account of kept) {
    if (account.name !== null) {
      const problem = checkName(account.name, `name-${account.key}`, 'validation.accountNameRequired');
      if (problem) return problem;
    }
    if (account.opening.trim() && parseAmount(account.opening, account.currency) === null) {
      return { field: `opening-${account.key}`, message: 'validation.amount' };
    }
  }
  return null;
}

/** Every rated currency needs both rates, buy not above sell (core's rule). */
export function validateRates(draft: OnboardingDraft): StepProblem | null {
  for (const currency of ratedOf(draft)) {
    const pair = draft.rates[currency] ?? { buy: '', sell: '' };
    for (const side of ['buy', 'sell'] as const) {
      if (!pair[side].trim()) return { field: `${side}-${currency}`, message: 'validation.rateRequired' };
    }
    const result = ratePairSchema.safeParse({ currency, buy: pair.buy.trim(), sell: pair.sell.trim() });
    if (!result.success) {
      const issue = result.error.issues[0];
      const side = issue?.path[0] === 'sell' ? 'sell' : 'buy';
      return { field: `${side}-${currency}`, message: issue?.message ?? 'validation.rate' };
    }
  }
  return null;
}
