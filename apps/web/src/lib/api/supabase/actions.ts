'use server';

import { type ApiErrorCode, onboardingSchema, type OnboardingInput, TERMS_VERSION, toMinor } from '@sarrif/core';

import { reportError } from '@/lib/report-error';
import { createClient } from '@/lib/supabase/server';

// Server actions: writes that must be checked on the server, not just in the
// browser. Anyone can POST to these directly, so each one checks who is
// signed in and parses its input with the same Zod schema the form uses.
//
// They never throw to the browser (production hides the message): they
// answer with a result, which the adapter turns into an ApiError.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ApiErrorCode; messageKey: string; fields: Record<string, string> };

const fail = (code: ApiErrorCode, messageKey: string, fields: Record<string, string> = {}): ActionResult<never> => ({
  ok: false,
  code,
  messageKey,
  fields,
});

/**
 * Open my shop: the whole setup in ONE database transaction
 * (complete_onboarding, supabase/migrations/*_main_shop.sql): the profile,
 * the workspace, the main shop, its accounts and opening amounts, today's
 * rates, and setup marked finished. All or nothing, and safe to call twice.
 */
export async function completeOnboardingAction(input: OnboardingInput): Promise<ActionResult<{ shopId: string }>> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join('.')] ??= issue.message;
    return fail('invalid', 'errors.invalid', fields);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('unauthenticated', 'errors.unauthenticated');

  const { profile, shop, accounts, rates } = parsed.data;
  const setup = {
    profile: {
      first_name: profile.name,
      phone: profile.phone,
      language: profile.language,
      // Only when they ticked it here (Google sign-ups); the rest agreed on Sign up.
      terms_version: profile.acceptTerms ? TERMS_VERSION : null,
    },
    shop: {
      name: shop.name,
      location: shop.location,
      base_currency: shop.baseCurrency,
      currencies: shop.currencies,
      time_zone: shop.timeZone,
      large_row_limit: toMinor('5000', shop.baseCurrency),
    },
    accounts: accounts.map((account) => ({
      name: account.name,
      type: account.type,
      currency: account.currency,
      provider: account.provider,
      opening_amount: account.openingBalance,
    })),
    rates: rates.map((quote) => ({ currency: quote.currency, units_per_usd: quote.perUsd })),
  };

  const { data, error } = await supabase.rpc('complete_onboarding', { setup });
  if (error) {
    // 22023: the database refused the setup itself (it passed Zod, so this is unexpected).
    reportError(error, { during: 'completeOnboarding', code: error.code });
    if (error.code === '42501' || error.code === 'PGRST301') return fail('unauthenticated', 'errors.unauthenticated');
    if (error.code === '22023' || error.code === '23514') return fail('invalid', 'errors.setupRefused', { form: 'errors.setupRefused' });
    return fail('unavailable', 'errors.serviceDown', { form: 'errors.serviceDown' });
  }
  return { ok: true, data: { shopId: data as string } };
}
