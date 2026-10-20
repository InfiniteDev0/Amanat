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
import { useRequestPasswordReset } from './queries';
import { type EmailFormValues, emailFormSchema } from './schemas';
import { useSubmitGuard } from './use-submit-guard';

/**
 * Forgot password: an email → a link to set a new one. The answer is the
 * same whether or not the address has an account, so nobody can use this
 * page to find out who's signed up.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const { setMode } = useAuthFlow();
  const reset = useRequestPasswordReset();
  const { online, run } = useSubmitGuard();
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { email: '' },
  });
  const backToLogIn = (
    <Link href="/" onClick={() => setMode('login')} className="text-muted-foreground hover:text-foreground mx-auto block w-fit text-sm underline-offset-4 hover:underline">
      {t('backToLogIn')}
    </Link>
  );

  if (reset.isSuccess) {
    return (
      <AuthStep title={t('checkEmailTitle')} subtitle={t('forgotSentBody', { email: ltr(reset.variables.email) })}>
        {backToLogIn}
      </AuthStep>
    );
  }

  return (
    <AuthStep title={t('forgotTitle')} subtitle={t('forgotBody')}>
      <form onSubmit={form.handleSubmit(({ email }) => run((done) => reset.mutate({ email, language: locale }, { onSettled: done })))} noValidate>
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
                  reset.reset();
                }}
                id="forgot-email"
                label={t('email')}
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                error={fieldError(fieldState, message)}
              />
            )}
          />
          <Button type="submit" disabled={reset.isPending || !online} className="h-11 w-full rounded-xl font-semibold">
            {reset.isPending ? <Loader className="animate-spin" /> : null}
            {reset.isPending ? t('sending') : t('sendLink')}
          </Button>
          <FormError>{reset.error ? message(formErrorKey(reset.error)) : null}</FormError>
          {backToLogIn}
        </FieldGroup>
      </form>
    </AuthStep>
  );
}
