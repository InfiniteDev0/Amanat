'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { AuthStep } from './auth-step';
import { useAuthFlow } from './auth-flow';

/**
 * An email link that didn't work: too old, used already, or opened in a
 * different browser from the one that asked for it. Back to log in, where
 * either Forgot password? or logging in sends a new one.
 */
export function LinkExpired() {
  const t = useTranslations('auth');
  const { setMode } = useAuthFlow();
  return (
    <AuthStep title={t('linkExpiredTitle')} subtitle={t('linkExpiredBody')}>
      <Link
        href="/"
        onClick={() => setMode('login')}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition-colors"
      >
        {t('backToLogIn')}
      </Link>
    </AuthStep>
  );
}
