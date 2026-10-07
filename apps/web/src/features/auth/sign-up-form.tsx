'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader, Mail, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import type { Locale } from '@/i18n/routing';
import { errorKey, useMessage } from '@/lib/api/errors';

import { DEFAULT_COUNTRY } from './countries';
import { CurrencyField } from './currency-field';
import { fieldError } from './field-error';
import { PhoneField } from './phone-field';
import { type SignUpFormInput, signUpFormSchema, type SignUpFormValues, toE164 } from './schemas';
import { TermsField } from './terms-field';
import { TextField } from './text-field';
import { useRequestCode } from './use-request-code';

/** The Sign up tab: first name, email, phone, currencies, terms → code by SMS. */
export function SignUpForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const { request, isPending, error } = useRequestCode();

  const form = useForm<SignUpFormInput, unknown, SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    // Check on submit only; editing a field clears its error (see `edited`).
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      firstName: '',
      email: '',
      phone: { country: DEFAULT_COUNTRY, number: '' },
      currencies: [],
      acceptTerms: false,
    },
  });
  const edited = (name: keyof SignUpFormInput) => form.clearErrors(name);

  const onSubmit = ({ firstName, email, phone, currencies }: SignUpFormValues) => {
    const e164 = toE164(phone);
    if (!e164) return; // the schema already checked it
    request(e164, { phone: e164, profile: { name: firstName, email, language: locale }, currencies });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <Controller
          name="firstName"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              onChange={(event) => {
                field.onChange(event);
                edited('firstName');
              }}
              id="signup-first-name"
              label={t('firstName')}
              icon={UserRound}
              autoComplete="off"
              error={fieldError(fieldState, message)}
            />
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              onChange={(event) => {
                field.onChange(event);
                edited('email');
              }}
              id="signup-email"
              label={t('email')}
              icon={Mail}
              type="email"
              inputMode="email"
              autoComplete="off"
              error={fieldError(fieldState, message)}
            />
          )}
        />
        <Controller
          name="phone"
          control={form.control}
          render={({ field, fieldState }) => (
            <PhoneField
              id="signup-phone"
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                edited('phone');
              }}
              onBlur={field.onBlur}
              error={fieldError(fieldState, message) ?? (error ? message(errorKey(error)) : null)}
              disabled={isPending}
            />
          )}
        />
        <Controller
          name="currencies"
          control={form.control}
          render={({ field, fieldState }) => (
            <CurrencyField
              value={field.value}
              onChange={(currencies) => {
                field.onChange(currencies);
                edited('currencies');
              }}
              error={fieldError(fieldState, message)}
            />
          )}
        />
        <Controller
          name="acceptTerms"
          control={form.control}
          render={({ field, fieldState }) => (
            <TermsField
              id="signup-terms"
              checked={field.value}
              onChange={(checked) => {
                field.onChange(checked);
                edited('acceptTerms');
              }}
              error={fieldError(fieldState, message)}
            />
          )}
        />

        <Button type="submit" disabled={isPending} className="h-11 w-full rounded-xl font-semibold">
          {isPending ? <Loader className="animate-spin" /> : null}
          {isPending ? t('sending') : t('signUp')}
        </Button>
      </FieldGroup>
    </form>
  );
}
