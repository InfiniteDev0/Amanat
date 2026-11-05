import { routeFor } from '@sarrif/core';
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
// 3. Where the request belongs, from the routing table in core (routing.ts):
//    signed out → the auth page with ?next=<that page>; setup not finished →
//    All shops, where the setup wizard opens; signed in on an auth page →
//    into the app.
//
// The (app) layout checks again on the server (lib/auth/server.ts), and
// SessionGate once more in the browser. With no Supabase project (the demo
// sign-in, never production: next.config.ts) only the browser checks.

const intl = createMiddleware(routing);

function splitLocale(pathname: string): { locale: string; page: string } | null {
  const [, first = '', ...rest] = pathname.split('/');
  if (!routing.locales.includes(first as (typeof routing.locales)[number])) return null;
  return { locale: first, page: `/${rest.join('/')}`.replace(/\/+$/, '') || '/' };
}

/** The language picked last time (next-intl's cookie), if it's one of ours. */
function savedLocale(request: NextRequest): string | null {
  const saved = request.cookies.get('NEXT_LOCALE')?.value;
  return saved && routing.locales.includes(saved as (typeof routing.locales)[number]) ? saved : null;
}

export default async function proxy(request: NextRequest) {
  // With detection off next-intl doesn't read its own cookie either, so a bare
  // address (localhost:3000, /w/…) would always open in Somali. The language
  // picked last time wins; a new visitor still gets Somali.
  const saved = savedLocale(request);
  if (saved && !splitLocale(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${saved}${url.pathname === '/' ? '' : url.pathname}`;
    return NextResponse.redirect(url);
  }

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
  const user = data.user;

  // Setup finished = the main shop exists (set in the same transaction). The
  // phone and the terms are part of setup, so an unfinished account never
  // reaches a shop page, even by typing its URL.
  let onboarded = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).single();
    onboarded = Boolean(profile?.onboarding_completed_at);
  }

  const { locale, page } = where;
  const target = routeFor(page, { signedIn: Boolean(user), emailConfirmed: Boolean(user?.email_confirmed_at), onboarded }, request.nextUrl.search);
  if (!target) return response;

  // A redirect that keeps any renewed session cookies.
  const redirect = NextResponse.redirect(new URL(withLocale(locale, target), request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

/** A path from the routing table ('/', '/?next=…', '/w/…') under the language. */
function withLocale(locale: string, path: string): string {
  return path === '/' || path.startsWith('/?') ? `/${locale}${path.slice(1)}` : `/${locale}${path}`;
}

export const config = {
  // Everything except API routes (the auth callbacks check their own links),
  // Next internals and files with an extension.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
