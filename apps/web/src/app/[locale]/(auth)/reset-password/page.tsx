import { ResetPasswordForm } from '@/features/auth/reset-password-form';

// Where the reset link lands, signed in by /api/auth/callback.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
