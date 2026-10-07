import { AuthShell } from '@/features/auth/auth-shell';

export default function AuthLayout({ children }: LayoutProps<'/[locale]'>) {
  return <AuthShell>{children}</AuthShell>;
}
