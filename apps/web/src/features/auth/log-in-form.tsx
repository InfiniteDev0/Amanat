'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { errorKey, useMessage } from '@/lib/api/errors';

import { DEFAULT_COUNTRY } from './countries';
import { fieldError } from './field-error';
import { PhoneField } from './phone-field';
import { type LogInFormValues, logInFormSchema, toE164 } from './schemas';
import { useRequestCode } from './use-request-code';

/**
 * The Log in tab: phone → code by SMS. A number with no account still works;
 * onboarding then asks for the name.
 */
export function LogInForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const { request, isPending, error } = useRequestCode();

  const form = useForm<LogInFormValues>({
    resolver: zodResolver(logInFormSchema),
    // Check on submit only; editing the number clears its error.
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { phone: { country: DEFAULT_COUNTRY, number: '' } },
  });

  const onSubmit = ({ phone }: LogInFormValues) => {
    const e164 = toE164(phone);
    if (e164) request(e164, null);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <Controller
          name="phone"
          control={form.control}
          render={({ field, fieldState }) => (
            <PhoneField
              id="login-phone"
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                form.clearErrors('phone');
              }}
              onBlur={field.onBlur}
              error={fieldError(fieldState, message) ?? (error ? message(errorKey(error)) : null)}
              disabled={isPending}
            />
          )}
        />

        <Button type="submit" disabled={isPending} className="h-11 w-full rounded-xl font-semibold">
          {isPending ? <Loader className="animate-spin" /> : null}
          {isPending ? t('sending') : t('logIn')}
        </Button>
      </FieldGroup>
    </form>
  );
}
