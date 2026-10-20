import { type NextRequest, NextResponse } from 'next/server';

import { routing } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';

// Where Supabase sends people back from an email link (confirm sign-up, reset
// password) or from Google, with a one-time `code`. The code is swapped for a
// session here, on the server, which sets the session cookies; then on to
// `next`. Under /api so the language middleware (proxy.ts) leaves it alone.
//
// It works only in the browser that asked for the link (PKCE): the code needs
// the verifier that browser kept. Anything that fails lands on link-expired.

/** `next` must be one of our own pages, starting with a language: never another site. */
function safeNext(next: string | null): string {
  const fallback = `/${routing.defaultLocale}`;
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  const locale = next.split('/')[1];
  return routing.locales.includes(locale as (typeof routing.locales)[number]) ? next : fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next'));
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // No code (Supabase sends ?error=… for an expired link), or it didn't work.
  const locale = next.split('/')[1];
  return NextResponse.redirect(new URL(`/${locale}/link-expired`, origin));
}
