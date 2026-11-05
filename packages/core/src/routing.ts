import { appReturnPath } from './paths';

// Where a request belongs, in one table used by the door (proxy.ts), the
// server layouts and the auth callbacks, so they can never disagree.
// Paths have no language prefix ('/w/abc', not '/en/w/abc').
//
//   signed out                  → the auth page ('/'), ?next=<the page>
//   email not confirmed         → Check your email
//   setup not finished          → Home, where the setup wizard opens
//   setup finished              → into the app (Home)
//
// "Setup finished" is profiles.onboarding_completed_at, set in the same
// transaction that creates the main shop: finished ⇔ has a shop.

export interface RouteState {
  signedIn: boolean;
  emailConfirmed: boolean;
  onboarded: boolean;
}

/** Pages anyone may open, signed in or not. */
export const PUBLIC_PAGES = ['/', '/check-email', '/forgot-password', '/reset-password', '/link-expired', '/terms'] as const;
/** Of those, the ones a signed-in person is sent on from, into the app. */
export const AUTH_ENTRY_PAGES = ['/', '/check-email', '/forgot-password', '/link-expired'] as const;
/** Home: your shops. The setup wizard opens over it (there is no onboarding page: it's an overlay). */
export const SETUP_PAGE = '/home';

const isOneOf = (list: readonly string[], page: string) => list.includes(page);

/** `next` from a query string ('?next=%2Fw%2Fabc'), decoded; null when absent or garbled. */
function nextParam(search: string): string | null {
  for (const part of search.replace(/^\?/, '').split('&')) {
    if (!part.startsWith('next=')) continue;
    try {
      return decodeURIComponent(part.slice(5).replace(/\+/g, ' '));
    } catch {
      return null;
    }
  }
  return null;
}
const isShopPage = (page: string) => page === '/w' || page.startsWith('/w/');

/**
 * Where to send this request instead, or null to let it through. `page` is
 * the path without language or query; `search` is the query string ('?x=1'),
 * kept for the page to come back to after logging in.
 */
export function routeFor(page: string, state: RouteState, search = ''): string | null {
  if (!state.signedIn) {
    if (isOneOf(PUBLIC_PAGES, page)) return null;
    const back = appReturnPath(`${page}${search}`);
    return back ? `/?next=${encodeURIComponent(back)}` : '/';
  }

  if (!state.emailConfirmed) {
    return page === '/check-email' || page === '/terms' ? null : '/check-email';
  }

  // Signed in on the auth page: on to the page they wanted (?next=), or home.
  if (isOneOf(AUTH_ENTRY_PAGES, page)) {
    const back = state.onboarded ? appReturnPath(nextParam(search)) : null;
    return back ?? SETUP_PAGE;
  }

  // A shop's pages wait until setup is finished.
  if (!state.onboarded && isShopPage(page)) return SETUP_PAGE;
  return null;
}
