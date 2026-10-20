'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';

import { AuthStep } from './auth-step';
import { useAuthFlow } from './auth-flow';
import { fieldError } from './field-error';
import { FormError } from './form-error';
import { useRequestPasswordReset, useResendConfirmation } from './queries';
import { type EmailFormValues, emailFormSchema } from './schemas';
import { useSubmitGuard } from './use-submit-guard';

/** Which email the dead link came from, so the new one is the same kind. */
export type LinkKind = 'signup' | 'recovery';

/**
 * An email link that didn't work: too old, or used already. Never a blank
 * page or an error code: their email → Send a new link (a confirmation or a
 * password reset, like the old one), or Log in. The answer is the same
 * whether or not the address has an account.
 */
export function LinkExpired({ kind = 'signup' }: { kind?: LinkKind }) {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const { setMode } = useAuthFlow();
  const resend = useResendConfirmation();
  const reset = useRequestPasswordReset();
  const sending = kind === 'recovery' ? reset : resend;
  const { online, run } = useSubmitGuard();
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { email: '' },
  });

  const logIn = (
    <Link
      href="/"
      onClick={() => setMode('login')}
      className="bg-field hover:bg-field-focus flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors"
    >
      {t('logIn')}
    </Link>
  );

  if (sending.isSuccess) {
    return (
      <AuthStep title={t('checkEmailTitle')} subtitle={t('newLinkSent', { email: ltr(sending.variables.email) })}>
        {logIn}
      </AuthStep>
    );
  }

  return (
    <AuthStep title={t('linkExpiredTitle')} subtitle={t('linkExpiredBody')}>
      <form
        onSubmit={form.handleSubmit(({ email }) => run((done) => sending.mutate({ email, language: locale }, { onSettled: done })))}
        noValidate
      >
        <FieldGroup className="gap-4">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  form.clearErrors();
                  sending.reset();
                }}
                id="expired-email"
                label={t('email')}
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                error={fieldError(fieldState, message)}
              />
            )}
          />
          <Button type="submit" disabled={sending.isPending || !online} className="h-11 w-full rounded-xl font-semibold">
            {sending.isPending ? <Loader className="animate-spin" /> : null}
            {sending.isPending ? t('sending') : t('sendNewLink')}
          </Button>
          <FormError>{sending.error ? message(formErrorKey(sending.error)) : null}</FormError>
          {logIn}
        </FieldGroup>
      </form>
    </AuthStep>
  );
}
