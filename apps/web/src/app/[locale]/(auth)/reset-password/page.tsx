import { NextIntlClientProvider } from 'next-intl';

import { ResetPasswordForm } from '@/features/auth/reset-password-form';

// Where the reset link lands, signed in by /api/auth/callback. Every word of
// the app: while the session loads it shows the app's frame (SessionGate).
export default function ResetPasswordPage() {
  return (
    <NextIntlClientProvider>
      <ResetPasswordForm />
    </NextIntlClientProvider>
  );
}
