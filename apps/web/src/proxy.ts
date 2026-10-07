import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

// Next 16's "proxy" (formerly middleware). For now it only puts the language
// in the URL. When real auth lands, it also refreshes the Supabase session and
// sends signed-out visitors to the auth page; until then the (app) layout's
// SessionGate does that in the browser against the mock.
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
