'use client';

import { gooeyToast } from 'goey-toast';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';

import { type SignUpDraft, useAuthFlow } from './auth-flow';
import { useSendCode } from './queries';

/**
 * How both tabs end: text the code, keep any sign-up details for step 2, and
 * go to the code screen.
 */
export function useRequestCode() {
  const t = useTranslations('auth');
  const router = useRouter();
  const sendCode = useSendCode();
  const { setDraft } = useAuthFlow();

  const request = (phone: string, draft: SignUpDraft | null) => {
    setDraft(draft);
    sendCode.mutate(
      { phone },
      {
        onSuccess: () => {
          gooeyToast.success(t('codeSent'));
          router.push({ pathname: '/verify', query: { phone } });
        },
      },
    );
  };

  return { request, isPending: sendCode.isPending, error: sendCode.error };
}
