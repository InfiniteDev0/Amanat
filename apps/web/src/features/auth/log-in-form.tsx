'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@sarrif/core';
import { useQueryClient } from '@tanstack/react-query';
import { Loader, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { CASHIER_EMAIL, DEMO_EMAIL, DEMO_PASSWORD, IS_DEMO_AUTH } from '@/lib/api';
import { formErrorKey, useMessage } from '@/lib/api/errors';

import { fieldError } from './field-error';
import { FormError } from './form-error';
import { GoogleButton } from './google-button';
import { destinationFor } from './home-path';
import { PasswordField } from './password-field';
import { useLogIn } from './queries';
import { type LogInFormValues, logInFormSchema } from './schemas';
import { useSubmitGuard } from './use-submit-guard';

/**
 * The Log in tab: email and password, Forgot password?, or Continue with
 * Google. A wrong password and an unknown email get the same message.
 */
export function LogInForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const logIn = useLogIn();

  const form = useForm<LogInFormValues>({
    resolver: zodResolver(logInFormSchema),
    // Check on submit only; editing a field clears the errors.
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });
  const edited = () => {
    form.clearErrors();
    logIn.reset();
  };
  const { online, run } = useSubmitGuard();
  const busy = logIn.isPending || logIn.isSuccess;
  // Signed up but never clicked the link: offer to send it again.
  const unconfirmed = logIn.error instanceof ApiError && logIn.error.messageKey === 'errors.emailNotConfirmed';

  const onSubmit = (values: LogInFormValues) =>
    run((done) =>
      logIn.mutate(values, {
        onSettled: done,
        // Everything typed stays, except the password.
        onError: () => form.setValue('password', ''),
        // Back to the page they were on if the session had ended (?next=).
        onSuccess: async (user) => router.replace(await destinationFor(user, queryClient), { locale: user.language }),
      }),
    );

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup className="gap-4">
          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  edited();
                }}
                id="login-email"
                label={t('email')}
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                error={fieldError(fieldState, message)}
              />
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <PasswordField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  edited();
                }}
                id="login-password"
                label={t('password')}
                autoComplete="current-password"
                // The email's error shows first; the password's after it's fixed.
                error={form.formState.errors.email ? null : fieldError(fieldState, message)}
              />
            )}
          />
          <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground -mt-1 w-fit self-end text-sm underline-offset-4 hover:underline">
            {t('forgotPassword')}
          </Link>

          <Button type="submit" disabled={busy || !online} className="h-11 w-full rounded-xl font-semibold">
            {busy ? <Loader className="animate-spin" /> : null}
            {busy ? t('loggingIn') : t('logIn')}
          </Button>
          {logIn.error ? (
            <FormError>
              {message(formErrorKey(logIn.error))}
              {unconfirmed ? (
                <Link
                  href={`/check-email?from=login&email=${encodeURIComponent(form.getValues('email').trim())}`}
                  className="text-foreground mt-1 block underline underline-offset-4"
                >
                  {t('resendEmail')}
                </Link>
              ) : null}
            </FormError>
          ) : null}
          {IS_DEMO_AUTH ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('demoHint', { owner: DEMO_EMAIL, cashier: CASHIER_EMAIL, password: DEMO_PASSWORD })}
            </p>
          ) : null}
        </FieldGroup>
      </form>
      <GoogleButton />
    </div>
  );
}
