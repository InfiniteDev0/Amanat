'use client';

import { useTranslations } from 'next-intl';

import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { SessionGate } from '@/features/auth/session-gate';
import { useSignOut } from '@/features/auth/queries';
import { useRouter } from '@/i18n/navigation';

// PLACEHOLDER until we design onboarding. The hooks it will use already
// exist: useUpdateProfile, useCreateWorkspace, useCreateAccount, useSetRates.

export function OnboardingPlaceholder() {
  return (
    <SessionGate requireProfile={false}>
      <Content />
    </SessionGate>
  );
}

function Content() {
  const t = useTranslations();
  const router = useRouter();
  const signOut = useSignOut();

  return (
    <section className="m-auto w-full max-w-md p-6">
      <LocaleSwitcher className="mb-8" />
      <h1 className="font-heading text-[2.5rem] leading-none font-semibold tracking-tight">{t('placeholder.onboardingTitle')}</h1>
      <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">{t('placeholder.onboardingBody')}</p>
      <Button variant="outline" size="lg" className="mt-8" onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace('/') })}>
        {t('common.signOut')}
      </Button>
    </section>
  );
}
