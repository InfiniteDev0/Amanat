'use client';

import { appReturnPath } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';

import { Loader } from '@/components/motion/loader';
import { FrameLoading } from '@/components/layout/frame-loading';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useMinimumWait } from '@/lib/use-minimum-wait';

import { useSession } from './queries';
import { isLeaving } from './use-sign-out-and-leave';

/** How long the loading screen stays at least, so it reads as one rather than a flash. */
const LOADING_MIN_MS = 2500;

/**
 * Lets only signed-in people through. Signed out → the auth page. Someone
 * whose setup isn't finished is let in: the setup wizard opens over the page
 * and asks for the shop, the phone (and the terms, for Google sign-ups).
 *
 * Signed out while on a page (the session ended, or another tab signed out):
 * the auth page gets ?next=<that page>, and logging in comes back to it.
 *
 * With real auth, proxy.ts redirects on the server first (core's routing
 * table) and this stays as the second line; with the demo it's the only one.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const user = session.data;
  const waited = useMinimumWait(LOADING_MIN_MS);

  useEffect(() => {
    if (session.isPending || session.isError) return;
    if (!user) {
      const here = isLeaving() ? null : appReturnPath(`${pathname}${window.location.search}`);
      router.replace(here ? `/?next=${encodeURIComponent(here)}` : '/');
    }
  }, [session.isPending, session.isError, user, router, pathname]);

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
  if (!user || !waited) {
    // As Barista's: the frame with a sheen, not dots on a blank page.
    return <FrameLoading />;
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
