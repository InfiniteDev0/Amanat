import { SessionGate } from '@/features/auth/session-gate';

// Everything inside the app needs a signed-in user who has finished their profile.
export default function AppLayout({ children }: LayoutProps<'/[locale]'>) {
  return <SessionGate>{children}</SessionGate>;
}
