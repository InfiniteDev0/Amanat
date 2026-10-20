'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { formErrorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';

import { AuthStep } from './auth-step';
import { DEFAULT_COUNTRY } from './countries';
import { FormError } from './form-error';
import { destinationFor } from './home-path';
import { PhoneField } from './phone-field';
import { useCompleteProfile, useSession } from './queries';
import { type CompleteProfileFormInput, completeProfileFormSchema, type CompleteProfileFormValues, toE164 } from './schemas';
import { LoadingScreen } from './session-gate';
import { TermsField } from './terms-field';
import { useSignOutAndLeave } from './use-sign-out-and-leave';
import { useSubmitGuard } from './use-submit-guard';

const FIELD_ORDER = ['phone', 'acceptTerms'] as const;

/**
 * For someone invited to a shop, who skips the setup wizard: the phone
 * (contact data), and the terms if they signed up with Google and haven't
 * agreed yet. Nothing else in the app opens until they're given (SessionGate
 * sends people here). Owners setting up their first shop give the same in
 * the wizard's first step instead.
 */
export function CompleteProfileForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const complete = useCompleteProfile();
  const signOut = useSignOutAndLeave();
  const needsTerms = session.data?.termsAcceptedAt === null;
  const form = useForm<CompleteProfileFormInput, unknown, CompleteProfileFormValues>({
    resolver: zodResolver(completeProfileFormSchema(needsTerms)),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { phone: { country: DEFAULT_COUNTRY, number: '' }, acceptTerms: false },
  });
  const edited = () => {
    form.clearErrors();
    complete.reset();
  };
  const { errors } = form.formState;
  const firstProblem = FIELD_ORDER.find((name) => errors[name]);
  const errorFor = (name: (typeof FIELD_ORDER)[number]) => {
    const key = name === firstProblem ? errors[name]?.message : undefined;
    return key ? message(key) : null;
  };
  const { online, run } = useSubmitGuard();
  const busy = complete.isPending || complete.isSuccess;

  // Signed out (or the session ended): back to the start.
  useEffect(() => {
    if (!session.isPending && !session.data) router.replace('/');
  }, [session.isPending, session.data, router]);

  if (!session.data) return <LoadingScreen />;
  const user = session.data;

  const onSubmit = ({ phone }: CompleteProfileFormValues) => {
    const e164 = toE164(phone);
    if (!e164) return;
    run((done) =>
      complete.mutate(
        { phone: e164, acceptTerms: needsTerms ? true : undefined },
        { onSettled: done, onSuccess: async (updated) => router.replace(await destinationFor(updated, queryClient)) },
      ),
    );
  };

  return (
    <AuthStep title={t('completeTitle')} subtitle={t(needsTerms ? 'completeBody' : 'completeBodyPhone')}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup className="gap-4">
          <Controller
            name="phone"
            control={form.control}
            render={({ field }) => (
              <PhoneField
                id="complete-phone"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  edited();
                }}
                onBlur={field.onBlur}
                error={errorFor('phone')}
                disabled={busy}
              />
            )}
          />
          {needsTerms ? (
          <Controller
            name="acceptTerms"
            control={form.control}
            render={({ field }) => (
              <TermsField
                id="complete-terms"
                checked={field.value}
                onChange={(checked) => {
                  field.onChange(checked);
                  edited();
                }}
                error={errorFor('acceptTerms')}
              />
            )}
          />
          ) : null}
          <Button type="submit" disabled={busy || !online} className="h-11 w-full rounded-xl font-semibold">
            {busy ? <Loader className="animate-spin" /> : null}
            {busy ? t('saving') : t('continue')}
          </Button>
          <FormError>{complete.error ? message(formErrorKey(complete.error)) : null}</FormError>
          <p className="text-muted-foreground text-center text-sm">
            {t('notYou', { email: ltr(user.email ?? '') })}{' '}
            <button type="button" onClick={signOut} className="text-foreground underline underline-offset-4 hover:opacity-70">
              {t('signOut')}
            </button>
          </p>
        </FieldGroup>
      </form>
    </AuthStep>
  );
}
