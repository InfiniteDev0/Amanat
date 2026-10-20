import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

import { localeNext } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

// Where the links in our emails land (sign-up confirmation, password reset):
// /api/auth/confirm?next=/en&token_hash=…&type=signup (the templates in
// supabase/templates add the token). The token is checked here, on the
// server, which signs the person in with cookies; then on to `next`.
//
// A token hash works on any device or browser, unlike a code: open the email
// on your phone after signing up on a laptop and it still works.

const TYPES: EmailOtpType[] = ['signup', 'recovery', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const { path, locale } = localeNext(searchParams.get('next'));
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const supabase = await createClient();

  if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(path, origin));
  }

  // Already signed in (an old link opened again): straight into the app, no error.
  const { data } = await supabase.auth.getUser();
  if (data.user) return NextResponse.redirect(new URL(`/${locale}`, origin));

  // Expired, used already, or not a link of ours: a page that offers a new one.
  const kind = type === 'recovery' ? 'recovery' : 'signup';
  return NextResponse.redirect(new URL(`/${locale}/link-expired?type=${kind}`, origin));
}
