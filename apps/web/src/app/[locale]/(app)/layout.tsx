import { SessionGate } from '@/features/auth/session-gate';
import { SetupGate } from '@/features/onboarding/setup-wizard';

// Everything inside the app needs a signed-in user. Someone with no shop yet
// sees the page with the setup wizard over it (no onboarding route).
export default function AppLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <SessionGate>
      <SetupGate>{children}</SetupGate>
    </SessionGate>
  );
}
