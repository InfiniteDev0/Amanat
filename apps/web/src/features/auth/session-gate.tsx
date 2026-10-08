'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Loader } from '@/components/motion/loader';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { useMinimumWait } from '@/lib/use-minimum-wait';

import { useSession } from './queries';

/** How long the loading screen stays at least, so it reads as one rather than a flash. */
const LOADING_MIN_MS = 2500;

/**
 * Lets only signed-in people through. Signed out → the auth page. Someone
 * without a name or a shop yet is let in: the setup wizard asks for both.
 *
 * Today this runs in the browser against the mock. With real auth, proxy.ts
 * redirects on the server first and this stays as the second line.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const router = useRouter();
  const session = useSession();
  const user = session.data;
  const waited = useMinimumWait(LOADING_MIN_MS);

  useEffect(() => {
    if (session.isPending || session.isError) return;
    if (!user) router.replace('/');
  }, [session.isPending, session.isError, user, router]);

  if (session.isError) {
    return (
      <Splash>
        <Button variant="outline" size="lg" onClick={() => session.refetch()}>
          {t('retry')}
        </Button>
      </Splash>
    );
  }
  if (!user || !waited) {
    return <LoadingScreen />;
  }
  return children;
}

/** The full-screen wait: beui's dots loader. */
export function LoadingScreen() {
  const t = useTranslations('common');
  return (
    <Splash>
      <Loader variant="dots" size={28} label={t('loading')} />
    </Splash>
  );
}

export function Splash({ children }: { children?: ReactNode }) {
  return <div className="text-muted-foreground flex min-h-svh flex-1 items-center justify-center text-sm">{children}</div>;
}
