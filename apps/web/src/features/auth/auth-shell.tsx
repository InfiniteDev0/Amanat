'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Flag } from '@/components/flag';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { AuthFlowProvider } from './auth-flow';
import { homePathFor } from './home-path';
import { useSession } from './queries';

/**
 * The frame around both auth steps (phone, then code). There is no landing
 * page: this is the first screen.
 *
 * Desktop: the photo on one side (logo, floating rate cards), the form on the
 * other on the plain dark background.
 * Phone: the photo fills the screen with "Get started", which slides it away
 * to the form.
 *
 * The form is rendered once and only its frame changes with the screen size,
 * so there is one set of inputs (one #phone, one code field, one form state).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthFlowProvider>
      <Frame>{children}</Frame>
    </AuthFlowProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const session = useSession();
  const onCodeStep = pathname.startsWith('/verify');
  const [started, setStarted] = useState(false);
  const showForm = started || onCodeStep;

  // Already signed in when the page opened: skip straight into the app. Only
  // the first answer counts, so signing in here doesn't trigger it twice.
  const firstSession = useRef<boolean | null>(null);
  useEffect(() => {
    if (session.isPending || firstSession.current !== null) return;
    firstSession.current = Boolean(session.data);
    if (session.data) {
      void homePathFor(session.data, queryClient).then((path) => router.replace(path));
    }
  }, [session.isPending, session.data, queryClient, router]);

  // No auto-focus on the first field: it pops Chrome's autofill list and the
  // phone keyboard before anyone asked. The code step focuses its own field.

  const back = () => (onCodeStep ? router.push('/') : setStarted(false));
  const year = new Date().getFullYear();

  return (
    // overflow-clip, not overflow-hidden: a clipped box can't be scrolled, so
    // nothing (focus, find-in-page) can drag the hidden panel into view.
    <div className="bg-background relative h-svh overflow-clip lg:grid lg:grid-cols-2">
      {/* Photo: the whole screen on a phone, the start half on desktop */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col overflow-hidden p-6 text-white transition-transform duration-300 ease-out lg:relative lg:p-8',
          showForm && 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
      >
        <Image src="/auth.jpg" alt="" fill priority className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
        <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/85 via-black/40 to-transparent lg:h-1/3 lg:from-black/40 lg:via-black/10" />

        <div className="relative z-20 flex items-center justify-between gap-4">
          <Image src="/logo.png" alt={t('brand.name')} width={767} height={325} priority className="h-11 w-auto lg:h-12" />
          <LocaleSwitcher className="lg:hidden" />
        </div>

        <div className="relative z-10 mt-auto">
          <RateCards className="mb-8 lg:ms-[4%] lg:mb-[6vh]" />

          <div className="lg:hidden">
            <h2 className="hero text-4xl">{t('auth.welcome', { name: t('brand.name') })}</h2>
            <p className="mt-2 text-sm text-white/80">{t('brand.tagline')}</p>
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 h-10 w-full rounded-lg text-sm font-semibold transition-colors"
            >
              {t('auth.getStarted')}
            </button>
          </div>
        </div>
      </div>

      {/* Form: slides in over the photo on a phone, the end half on desktop */}
      <div
        className={cn(
          'bg-background absolute inset-0 flex min-h-0 flex-col transition-transform duration-300 ease-out lg:relative',
          !showForm && 'max-lg:ltr:translate-x-full max-lg:rtl:-translate-x-full',
        )}
      >
        <div className="relative z-20 flex shrink-0 items-center justify-between gap-2 p-6 md:px-10">
          <button
            type="button"
            onClick={back}
            aria-label={t('auth.back')}
            className="flex size-9 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 lg:invisible"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" />
          </button>
          <LocaleSwitcher />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 overflow-y-auto px-6 md:px-10">{children}</div>
        <p className="text-muted-foreground relative z-10 shrink-0 py-4 text-center text-xs lg:hidden">{t('brand.copyright', { year })}</p>
      </div>
    </div>
  );
}

/**
 * The floating glass cards on the photo. Decoration only (sample figures, not
 * data), so screen readers skip them.
 */
function RateCards({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('w-fit', className)}>
      <RateCard flag="US" code="USD" value="129.50" change="+0.4%" className="relative z-10" />
      <RateCard flag="KE" code="KES" value="0.0077" change="+0.1%" className="-mt-3 ms-7 bg-black/55" />
    </div>
  );
}

function RateCard({
  flag,
  code,
  value,
  change,
  className,
}: {
  flag: string;
  code: string;
  value: string;
  change: string;
  className?: string;
}) {
  const t = useTranslations('auth');
  return (
    <div className={cn('flex w-64 items-center gap-3 rounded-lg bg-black/40 px-4 py-3 backdrop-blur-md', className)}>
      <Flag code={flag} className="h-6 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="leading-tight font-semibold">{code}</p>
        <p className="mt-0.5 text-xs text-white/70">{t('heroRate')}</p>
      </div>
      <div dir="ltr" className="text-end tabular-nums">
        <p className="leading-tight font-semibold">{value}</p>
        <p className="text-success mt-0.5 text-sm font-semibold">{change}</p>
      </div>
    </div>
  );
}
