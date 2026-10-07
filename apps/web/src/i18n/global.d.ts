import type messages from '../../messages/en.json';
import type { routing } from './routing';

// English is the reference: a key missing from en.json is a type error, so a
// typo in t('…') fails the build instead of showing a raw key to a cashier.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
