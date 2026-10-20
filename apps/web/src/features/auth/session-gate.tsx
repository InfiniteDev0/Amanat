'use client';

import { appReturnPath, needsProfile } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Loader } from '@/components/motion/loader';
import { Button } from '@/components/ui/button';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useMinimumWait } from '@/lib/use-minimum-wait';

import { useSession } from './queries';
import { isLeaving } from './use-sign-out-and-leave';

/** How long the loading screen stays at least, so it reads as one rather than a flash. */
const LOADING_MIN_MS = 2500;

/**
 * Lets only signed-in people through. Signed out → the auth page. Someone
 * without a shop yet is let in: the setup wizard asks for the shop, and for
 * the phone (and the terms, for Google sign-ups) in its first step. Someone
 * in a shop (invited) with no phone or terms yet → Complete your profile.
 *
 * Signed out while on a page (the session ended, or another tab signed out):
 * the auth page gets ?next=<that page>, and logging in comes back to it.
 *
 * Today this runs in the browser against the mock. With real auth, proxy.ts
 * redirects on the server first and this stays as the second line.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const user = session.data;
  const waited = useMinimumWait(LOADING_MIN_MS);

  // Only an incomplete profile needs the shop list, to tell the wizard's case from an invite.
  const incomplete = user ? needsProfile(user) : false;
  const workspaces = useMyWorkspaces({ enabled: incomplete });
  const invited = incomplete && workspaces.isSuccess && workspaces.data.length > 0;
  const deciding = incomplete && workspaces.isPending;

  useEffect(() => {
    if (session.isPending || session.isError) return;
    if (!user) {
      const here = isLeaving() ? null : appReturnPath(`${pathname}${window.location.search}`);
      router.replace(here ? `/?next=${encodeURIComponent(here)}` : '/');
    } else if (invited) router.replace('/complete-profile');
  }, [session.isPending, session.isError, user, invited, router, pathname]);

  // The back button after signing out can bring this page back from the
  // browser's memory (bfcache): ask again who's signed in before showing it.
  const { refetch } = session;
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refetch();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [refetch]);

  if (session.isError) {
    return (
      <Splash>
        <Button variant="outline" size="lg" onClick={() => session.refetch()}>
          {t('retry')}
        </Button>
      </Splash>
    );
  }
  if (!user || invited || deciding || !waited) {
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
