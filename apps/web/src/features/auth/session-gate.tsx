'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

import { useSession } from './queries';

/**
 * Lets only signed-in people through. Signed out → the auth page. With
 * `requireProfile`, someone who hasn't given their name yet goes to onboarding.
 *
 * Today this runs in the browser against the mock. With real auth, proxy.ts
 * redirects on the server first and this stays as the second line.
 */
export function SessionGate({ children, requireProfile = true }: { children: ReactNode; requireProfile?: boolean }) {
  const t = useTranslations('common');
  const router = useRouter();
  const session = useSession();
  const user = session.data;
  const needsProfile = requireProfile && user && !user.name;

  useEffect(() => {
    if (session.isPending || session.isError) return;
    if (!user) router.replace('/');
    else if (needsProfile) router.replace('/onboarding');
  }, [session.isPending, session.isError, user, needsProfile, router]);

  if (session.isError) {
    return (
      <Splash>
        <Button variant="outline" size="lg" onClick={() => session.refetch()}>
          {t('retry')}
        </Button>
      </Splash>
    );
  }
  if (!user || needsProfile) {
    return <Splash>{t('loading')}</Splash>;
  }
  return children;
}

export function Splash({ children }: { children?: ReactNode }) {
  return <div className="text-muted-foreground flex min-h-svh flex-1 items-center justify-center text-sm">{children}</div>;
}
