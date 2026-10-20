'use client';

import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';

import { useSignOut } from './queries';

/**
 * Set while this tab signs out on purpose, so SessionGate sends it to the
 * plain auth page: a ?next= back to this person's shop would be wrong for
 * whoever logs in next on this browser.
 */
let leaving = false;
export const isLeaving = () => leaving;

/**
 * Sign out with one toast that follows it ("Signing out…", then "Signed
 * out" or what went wrong), then back to the auth page. `everywhere` signs
 * out every device too (a lost or stolen phone).
 */
export function useSignOutAndLeave() {
  const t = useTranslations('common');
  const message = useMessage();
  const router = useRouter();
  const signOut = useSignOut();

  return (options: { everywhere?: boolean } = {}) => {
    leaving = true;
    promiseToast(signOut.mutateAsync(options), {
      loading: t('signingOut'),
      success: t('signedOut'),
      error: (error) => message(errorKey(error)),
      description: {
        loading: t('signingOutDescription'),
        success: t('signedOutDescription'),
        error: t('signOutFailedDescription'),
      },
    }).then(
      () => {
        router.replace('/');
        leaving = false;
      },
      () => {
        leaving = false;
      },
    );
  };
}
