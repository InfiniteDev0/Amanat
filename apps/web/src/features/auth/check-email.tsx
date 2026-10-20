'use client';

import { MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';

import { AuthStep } from './auth-step';
import { useAuthFlow } from './auth-flow';
import { FormError } from './form-error';
import { useResendConfirmation } from './queries';
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
  const { setMode } = useAuthFlow();
  const resend = useResendConfirmation();
  const { online, run } = useSubmitGuard();
  const [cooldown, setCooldown] = useState(fromLogIn ? 0 : RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendAgain = () =>
    run((done) => resend.mutate({ email, language: locale }, { onSettled: done, onSuccess: () => setCooldown(RESEND_COOLDOWN_S) }));

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
          <Link href="/" onClick={() => setMode('login')} className="bg-field hover:bg-field-focus rounded-xl px-4 py-2.5 font-medium transition-colors">
            {t('backToLogIn')}
          </Link>
        </div>
        {resend.isSuccess && cooldown > 0 ? <p className="text-muted-foreground w-full text-sm">{t('emailSent')}</p> : null}
        <FormError className="w-full">{resend.error ? message(formErrorKey(resend.error)) : null}</FormError>
      </div>
    </AuthStep>
  );
}
