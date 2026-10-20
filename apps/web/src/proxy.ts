import { appReturnPath } from '@sarrif/core';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { SUPABASE_CONFIGURED, supabasePublishableKey, supabaseUrl } from './lib/supabase/env';

// Next 16's "proxy" (formerly middleware): the door. On every page request,
// before anything is rendered:
//
// 1. The language goes in the URL (next-intl), as before.
// 2. The Supabase session cookie is checked with Supabase (getUser, so a
//    tampered cookie or a session signed out on every device counts as
//    signed out) and quietly renewed; renewed cookies go out on the response.
// 3. Locked by default: signed out on any page but the auth pages → the auth
//    page with ?next=<that page>. Signed in on an auth page → into the app.
//
// The (app) layout checks again on the server (lib/auth/server.ts), and
// SessionGate once more in the browser. With no Supabase project (the demo
// sign-in, never production: next.config.ts) only the browser checks.

const intl = createMiddleware(routing);

/** Pages anyone may open, signed in or not (paths without the language). */
const PUBLIC_PAGES = ['/', '/check-email', '/forgot-password', '/reset-password', '/link-expired', '/terms'];
/** Of those, the ones a signed-in person is sent on from, into the app. */
const AUTH_ENTRY_PAGES = ['/', '/check-email', '/forgot-password', '/link-expired'];

function splitLocale(pathname: string): { locale: string; page: string } | null {
  const [, first = '', ...rest] = pathname.split('/');
  if (!routing.locales.includes(first as (typeof routing.locales)[number])) return null;
  return { locale: first, page: `/${rest.join('/')}`.replace(/\/+$/, '') || '/' };
}

export default async function proxy(request: NextRequest) {
  const response = intl(request);
  // The language is being added to the URL: the next request comes back here.
  if (!SUPABASE_CONFIGURED || response.headers.has('location')) return response;
  const where = splitLocale(request.nextUrl.pathname);
  if (!where) return response;

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  // Nothing may run between creating the client and this call (it's what renews the session).
  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);

  /** A redirect that keeps any renewed session cookies. */
  const goTo = (path: string) => {
    const redirect = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  const { locale, page } = where;
  if (!signedIn && !PUBLIC_PAGES.includes(page)) {
    const here = appReturnPath(`${page}${request.nextUrl.search}`);
    return goTo(here ? `/${locale}?next=${encodeURIComponent(here)}` : `/${locale}`);
  }
  if (signedIn && AUTH_ENTRY_PAGES.includes(page)) {
    // Back to the page they wanted, if it's ours; else All shops, which opens their last shop.
    const back = appReturnPath(request.nextUrl.searchParams.get('next'));
    return goTo(`/${locale}${back ?? '/all-shops'}`);
  }
  // A shop's pages need a phone and the terms (Google sign-ups have neither
  // at first): checked here, before anything is sent, so typing a URL can't
  // skip Complete your profile. Someone with no shop gives both in the setup
  // wizard on All shops. The shop layout checks again (lib/auth/server.ts).
  if (signedIn && page.startsWith('/w/')) {
    const { data: profile } = await supabase.from('profiles').select('phone, terms_accepted_at').eq('id', data.user!.id).single();
    if (!profile?.phone || !profile.terms_accepted_at) return goTo(`/${locale}/complete-profile`);
  }
  return response;
}

export const config = {
  // Everything except API routes (the auth callbacks check their own links),
  // Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
