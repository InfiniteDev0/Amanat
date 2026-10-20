import { type NextRequest, NextResponse } from 'next/server';

import { localeNext } from '@/lib/auth-redirect';
import { reportError } from '@/lib/report-error';
import { createClient } from '@/lib/supabase/server';

// Where Google sends people back (through Supabase), with a one-time `code`.
// The code is swapped for a session here, on the server, which sets the
// session cookies; then on to `next`. Under /api so the language middleware
// (proxy.ts) leaves it alone. Email links use /api/auth/confirm instead.
//
// Every way out lands somewhere calm: cancelled on Google's screen → back to
// log in with "Google sign-in was cancelled"; anything else that fails →
// "We couldn't finish signing you in" with the Google button to try again.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const { path, locale } = localeNext(searchParams.get('next'));
  const code = searchParams.get('code');
  const providerError = searchParams.get('error');
  const back = (notice: string) => NextResponse.redirect(new URL(`/${locale}?auth_error=${notice}`, origin));

  // Pressed Cancel (or "Back to safety") on Google's screen.
  if (providerError === 'access_denied') return back('google_cancelled');

  const supabase = await createClient();
  if (code && !providerError) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(path, origin));
    reportError(error, { during: 'googleCallback', code: error.code });
  } else if (providerError) {
    reportError(new Error(providerError), { during: 'googleCallback', description: searchParams.get('error_description') });
  }

  // Already signed in (the back button, a second tab): into the app, no error.
  const { data } = await supabase.auth.getUser();
  if (data.user) return NextResponse.redirect(new URL(`/${locale}`, origin));
  return back('google_failed');
}
