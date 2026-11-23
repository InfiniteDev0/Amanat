import { NextIntlClientProvider } from 'next-intl';

import { SessionGate } from '@/features/auth/session-gate';
import { SetupGate } from '@/features/onboarding/setup-wizard';
import { requireUser, SERVER_AUTH } from '@/lib/auth/server';

// Everything inside the app needs a signed-in user: checked at the door
// (proxy.ts), again here on the server, and once more in the browser
// (SessionGate). Someone with no shop yet sees the page with the setup wizard
// over it (no onboarding route). Its own messages provider brings every
// word of the app (the root layout sends signed-out pages only theirs).
export default async function AppLayout({ children, params }: LayoutProps<'/[locale]'>) {
  if (SERVER_AUTH) await requireUser((await params).locale);
  return (
    <NextIntlClientProvider>
      <SessionGate>
        <SetupGate>{children}</SetupGate>
      </SessionGate>
    </NextIntlClientProvider>
  );
}
