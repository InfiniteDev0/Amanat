'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader, Mail, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { formErrorKey, useMessage } from '@/lib/api/errors';

import { FormError } from './form-error';
import { GoogleButton } from './google-button';
import { homePathFor } from './home-path';
import { PasswordField } from './password-field';
import { useSignUp } from './queries';
import { type SignUpFormInput, signUpFormSchema, type SignUpFormValues } from './schemas';
import { TermsField } from './terms-field';

/** Top to bottom; only the first field with a problem shows it. */
const FIELD_ORDER = ['firstName', 'email', 'password', 'acceptTerms'] as const;

/**
 * The Sign up tab: first name, email, password (with its strength), terms →
 * "Check your email". Or Continue with Google. The phone is asked for later,
 * in the setup wizard.
 */
export function SignUpForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const signUp = useSignUp();

  const form = useForm<SignUpFormInput, unknown, SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    // Check on submit only. One problem shows at a time (the first, in form
    // order), and any edit clears it until the next submit.
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      firstName: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  });
  const edited = () => {
    form.clearErrors();
    signUp.reset();
  };
  // Read from the form, not each field's fieldState: a field only tracks its
  // own error once it has read it, so a field skipped earlier would be stale.
  const { errors } = form.formState;
  const firstProblem = FIELD_ORDER.find((name) => errors[name]);
  const errorFor = (name: (typeof FIELD_ORDER)[number]) => {
    const key = name === firstProblem ? errors[name]?.message : undefined;
    return key ? message(key) : null;
  };
  const busy = signUp.isPending || signUp.isSuccess;

  const onSubmit = ({ firstName, email, password }: SignUpFormValues) => {
    signUp.mutate(
      { firstName, email, password, acceptTerms: true, language: locale },
      {
        onSuccess: async (result) => {
          if (result.status === 'confirm_email') {
            router.push(`/check-email?email=${encodeURIComponent(email)}`);
            return;
          }
          router.replace(await homePathFor(result.user, queryClient));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup className="gap-4">
          <Controller
            name="firstName"
            control={form.control}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  edited();
                }}
                id="signup-first-name"
                label={t('firstName')}
                icon={UserRound}
                autoComplete="given-name"
                error={errorFor('firstName')}
              />
            )}
          />
          <Controller
            name="email"
            control={form.control}
            render={({ field }) => (
              <TextField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  edited();
                }}
                id="signup-email"
                label={t('email')}
                icon={Mail}
                type="email"
                inputMode="email"
                autoComplete="email"
                error={errorFor('email')}
              />
            )}
          />
          <Controller
            name="password"
            control={form.control}
            render={({ field }) => (
              <PasswordField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  edited();
                }}
                id="signup-password"
                label={t('password')}
                autoComplete="new-password"
                meter
                error={errorFor('password')}
              />
            )}
          />
          <Controller
            name="acceptTerms"
            control={form.control}
            render={({ field }) => (
              <TermsField
                id="signup-terms"
                checked={field.value}
                onChange={(checked) => {
                  field.onChange(checked);
                  edited();
                }}
                error={errorFor('acceptTerms')}
              />
            )}
          />

          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl font-semibold">
            {busy ? <Loader className="animate-spin" /> : null}
            {busy ? t('signingUp') : t('signUp')}
          </Button>
          <FormError>{signUp.error ? message(formErrorKey(signUp.error)) : null}</FormError>
        </FieldGroup>
      </form>
      <GoogleButton />
    </div>
  );
}
