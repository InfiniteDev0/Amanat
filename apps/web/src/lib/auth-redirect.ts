import { sameSitePath } from '@sarrif/core';

import { routing } from '@/i18n/routing';

/**
 * The `next` of an email link or the Google callback: a page of ours that
 * starts with a language ("/en", "/so/reset-password"). Anything else,
 * another site above all, falls back to the default language's start page.
 */
export function localeNext(next: string | null): { path: string; locale: string } {
  const path = sameSitePath(next);
  const locale = path?.split(/[/?#]/)[1];
  if (path && locale && routing.locales.includes(locale as (typeof routing.locales)[number])) return { path, locale };
  return { path: `/${routing.defaultLocale}`, locale: routing.defaultLocale };
}
