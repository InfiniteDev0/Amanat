'use client';

import { Loader } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

import type { Locale } from '@/i18n/routing';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { useOnline } from '@/lib/use-online';

import { FormError } from './form-error';
import { useGoogleSignIn } from './queries';
import { returnPath } from './return-path';

/** If the browser hasn't left for Google by then, the button comes back. */
const LEAVE_TIMEOUT_MS = 15_000;

/**
 * "or", then Continue with Google. Google's page comes back to
 * /api/auth/callback, which signs the person in, or brings them back here
 * with a calm message (cancelled, or couldn't finish). A first-time Google
 * user is then asked for their phone and the terms.
 *
 * Never an endless spinner: it stops if the browser didn't leave, and when
 * the back button returns from Google's page (the page comes back from the
 * browser's memory, still spinning).
 */
export function GoogleButton() {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const online = useOnline();
  const google = useGoogleSignIn();
  const { reset, isSuccess } = google;
  // Stays busy after success: the browser is on its way to Google.
  const busy = google.isPending || isSuccess;

  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [reset]);

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(reset, LEAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isSuccess, reset]);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-foreground/10 h-px flex-1" />
        {t('or')}
        <span className="bg-foreground/10 h-px flex-1" />
      </div>
      <button
        type="button"
        onClick={() => {
          if (!busy) google.mutate({ language: locale, next: returnPath() ?? undefined });
        }}
        disabled={busy || !online}
        className="bg-field hover:bg-field-focus flex h-11 w-full items-center justify-center gap-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {busy ? <Loader className="size-4 animate-spin" /> : <GoogleMark />}
        {t('google')}
      </button>
      <FormError>{google.error ? message(formErrorKey(google.error)) : null}</FormError>
    </div>
  );
}

/** Google's "G" in its own colours, as their sign-in button guidelines ask. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5 shrink-0">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
