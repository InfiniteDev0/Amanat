'use client';

import { gooeyToast } from 'goey-toast';
import { useQueryClient } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Link, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';

import { AuthStep } from './auth-step';
import { useAuthFlow } from './auth-flow';
import { FormError } from './form-error';
import { destinationFor } from './home-path';
import { useResendConfirmation, useSession } from './queries';
import { useSubmitGuard } from './use-submit-guard';

/** Seconds before the email can be sent again. Supabase also limits it per hour. */
const RESEND_COOLDOWN_S = 60;

/**
 * After Sign up: the link is in their inbox. They can have it sent again
 * (after a minute), or go back to log in. Shown the same way whether or not
 * the address already had an account.
 */
export function CheckEmail({ email, fromLogIn = false }: { email: string; fromLogIn?: boolean }) {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const { logInAs, setMode } = useAuthFlow();
  const router = useRouter();
  const queryClient = useQueryClient();
  const resend = useResendConfirmation();
  // Confirmed in another tab (the link opens one): carry on into the app from here too.
  const session = useSession({ watch: true });
  useEffect(() => {
    if (session.data) void destinationFor(session.data, queryClient).then((path) => router.replace(path));
  }, [session.data, queryClient, router]);
  const { online, run } = useSubmitGuard();
  const [cooldown, setCooldown] = useState(fromLogIn ? 0 : RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendAgain = () =>
    run((done) =>
      resend.mutate(
        { email, language: locale },
        {
          onSettled: done,
          onSuccess: () => {
            setCooldown(RESEND_COOLDOWN_S);
            gooeyToast.success(t('emailSent'));
          },
        },
      ),
    );

  return (
    <AuthStep title={t('checkEmailTitle')} subtitle={t('checkEmailBody', { email: ltr(email) })}>
      <div className="flex flex-col items-center gap-6">
        <span className="bg-field flex size-16 items-center justify-center rounded-2xl">
          <MailCheck className="size-8" />
        </span>
        <p className="text-muted-foreground text-center text-sm">{t('checkEmailHint')}</p>
        <div className="flex w-full items-center justify-between gap-4 text-sm">
          <button
            type="button"
            onClick={sendAgain}
            disabled={cooldown > 0 || resend.isPending || !online}
            className="text-foreground underline underline-offset-4 transition hover:opacity-70 disabled:no-underline disabled:opacity-50"
          >
            {cooldown > 0 ? t('resendIn', { seconds: cooldown }) : t('resendEmail')}
          </button>
          <Link href="/" onClick={() => logInAs(email)} className="bg-field hover:bg-field-focus rounded-xl px-4 py-2.5 font-medium transition-colors">
            {t('backToLogIn')}
          </Link>
        </div>
        {/* Shown to everyone, so it says nothing about whether the address has an account. */}
        <p className="text-muted-foreground text-sm">
          {t('haveAccount')}{' '}
          <Link href="/" onClick={() => logInAs(email)} className="text-foreground underline underline-offset-4 hover:opacity-70">
            {t('logIn')}
          </Link>
        </p>
        {/* Typed the wrong address: back to Sign up to enter another one. */}
        <p className="text-muted-foreground text-sm">
          {t('wrongEmail')}{' '}
          <Link href="/" onClick={() => setMode('signup')} className="text-foreground underline underline-offset-4 hover:opacity-70">
            {t('useDifferentEmail')}
          </Link>
        </p>
        <FormError className="w-full">{resend.error ? message(formErrorKey(resend.error)) : null}</FormError>
      </div>
    </AuthStep>
  );
}
