import { defineRouting } from 'next-intl/routing';

// The language is the first part of every URL: /en/w/…, /so/w/…, /ar/w/….
// Adding a language = a new messages/<code>.json and one entry here.
export const routing = defineRouting({
  locales: ['en', 'so', 'ar'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];

/** Arabic flips the whole layout. Everything else reads left to right. */
export function directionOf(locale: string): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
