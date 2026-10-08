'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader, Mail, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { CurrencyField } from '@/components/currency-field';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import type { Locale } from '@/i18n/routing';
import { useMessage } from '@/lib/api/errors';

import { DEFAULT_COUNTRY } from './countries';
import { PhoneField } from './phone-field';
import { type SignUpFormInput, signUpFormSchema, type SignUpFormValues, toE164 } from './schemas';
import { TermsField } from './terms-field';
import { useRequestCode } from './use-request-code';

/** Top to bottom; only the first field with a problem shows it. */
const FIELD_ORDER = ['firstName', 'email', 'phone', 'currencies', 'acceptTerms'] as const;

/** The Sign up tab: first name, email, phone, currencies, terms → code by SMS. */
export function SignUpForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const locale = useLocale() as Locale;
  const { request, isPending } = useRequestCode();

  const form = useForm<SignUpFormInput, unknown, SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    // Check on submit only. One problem shows at a time (the first, in form
    // order), and any edit clears it until the next submit.
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
  const edited = () => form.clearErrors();
  // Read from the form, not each field's fieldState: a field only tracks its
  // own error once it has read it, so a field skipped earlier would be stale.
  const { errors } = form.formState;
  const firstProblem = FIELD_ORDER.find((name) => errors[name]);
  const errorFor = (name: (typeof FIELD_ORDER)[number]) => {
    const key = name === firstProblem ? errors[name]?.message : undefined;
    return key ? message(key) : null;
  };

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
              autoComplete="off"
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
              autoComplete="off"
              error={errorFor('email')}
            />
          )}
        />
        <Controller
          name="phone"
          control={form.control}
          render={({ field }) => (
            <PhoneField
              id="signup-phone"
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                edited();
              }}
              onBlur={field.onBlur}
              error={errorFor('phone')}
              disabled={isPending}
            />
          )}
        />
        <Controller
          name="currencies"
          control={form.control}
          render={({ field }) => (
            <CurrencyField
              value={field.value}
              onChange={(currencies) => {
                field.onChange(currencies);
                edited();
              }}
              error={errorFor('currencies')}
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

        <Button type="submit" disabled={isPending} className="h-11 w-full rounded-xl font-semibold">
          {isPending ? <Loader className="animate-spin" /> : null}
          {isPending ? t('sending') : t('signUp')}
        </Button>
      </FieldGroup>
    </form>
  );
}
