import type { AbstractIntlMessages } from 'next-intl';

// What a signed-out page sends the browser: only the words of signing in, the
// brand, the language menu, the terms and the errors a form can show. The
// rest (accounts, M-Pesa, exchanges, money moves…) goes only to signed-in
// pages, through the (app) layout's own provider. A login page that carried
// mobile-money and bank wording in its source looked, to Google Safe
// Browsing, like a fake mobile-money login (flagged on 2026-11-23).
//
// A signed-out component that needs another namespace: add it here (and keep
// money and payment brands out of it).
export const PUBLIC_NAMESPACES = ['auth', 'brand', 'language', 'errors', 'validation', 'terms', 'common'] as const;

/** Only the public namespaces of `messages`. */
export function publicMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return Object.fromEntries(PUBLIC_NAMESPACES.filter((ns) => ns in messages).map((ns) => [ns, messages[ns]!]));
}
