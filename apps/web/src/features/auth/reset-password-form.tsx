'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import { Loader } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { formErrorKey, useMessage } from '@/lib/api/errors';

import { AuthStep } from './auth-step';
import { FormError } from './form-error';
import { destinationFor } from './home-path';
import { LinkExpired } from './link-expired';
import { PasswordField } from './password-field';
import { useSession, useSetNewPassword } from './queries';
import { type NewPasswordFormValues, newPasswordFormSchema } from './schemas';
import { LoadingScreen } from './session-gate';
import { useSubmitGuard } from './use-submit-guard';

/**
 * Where the reset link lands: the callback has already signed them in with
 * it, so the new password is set for that account. No session (the link was
 * old or used) shows the expired-link page instead.
 */
export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const message = useMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const setPassword = useSetNewPassword();
  const form = useForm<NewPasswordFormValues>({
    resolver: zodResolver(newPasswordFormSchema),
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: { password: '' },
  });
  const { online, run } = useSubmitGuard();
  const busy = setPassword.isPending || setPassword.isSuccess;

  if (session.isPending) return <LoadingScreen />;
  if (!session.data) return <LinkExpired kind="recovery" />;
  const user = session.data;

  const onSubmit = ({ password }: NewPasswordFormValues) =>
    run((done) =>
      setPassword.mutate(
        { password },
        {
          onSettled: done,
          onError: () => form.setValue('password', ''),
          onSuccess: async () => {
            gooeyToast.success(t('passwordChanged'));
            router.replace(await destinationFor(user, queryClient));
          },
        },
      ),
    );

  return (
    <AuthStep title={t('resetTitle')} subtitle={t('resetBody')}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FieldGroup className="gap-4">
          {/* For the browser's password manager: which account this password is for. */}
          <input type="email" name="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <PasswordField
                {...field}
                onChange={(event) => {
                  field.onChange(event);
                  form.clearErrors();
                  setPassword.reset();
                }}
                id="reset-password"
                label={t('newPassword')}
                autoComplete="new-password"
                meter
                error={fieldState.error?.message ? message(fieldState.error.message) : null}
              />
            )}
          />
          <Button type="submit" disabled={busy || !online} className="h-11 w-full rounded-xl font-semibold">
            {busy ? <Loader className="animate-spin" /> : null}
            {busy ? t('saving') : t('savePassword')}
          </Button>
          <FormError>{setPassword.error ? message(formErrorKey(setPassword.error)) : null}</FormError>
        </FieldGroup>
      </form>
    </AuthStep>
  );
}
