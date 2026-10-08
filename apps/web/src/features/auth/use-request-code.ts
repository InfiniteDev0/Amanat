'use client';

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/navigation';
import { errorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';
import { promiseToast } from '@/lib/promise-toast';

import { type SignUpDraft, useAuthFlow } from './auth-flow';
import { useSendCode } from './queries';

/** The toast for texting a code ("Sending…" → "Code sent" + "Check your phone"), shared with Resend. */
export function useCodeToast() {
  const t = useTranslations('auth');
  const message = useMessage();
  return <T>(sending: Promise<T>, phone: string) => {
    const pretty = ltr(parsePhoneNumberFromString(phone)?.formatInternational() ?? phone);
    return promiseToast(sending, {
      loading: t('sending'),
      success: t('codeSent'),
      error: (error) => message(errorKey(error)),
      description: {
        loading: t('sendingDescription', { phone: pretty }),
        success: t('codeSentDescription', { phone: pretty }),
        error: t('sendFailedDescription'),
      },
      action: { success: { label: t('checkPhone'), successLabel: t('gotIt'), onClick: () => undefined } },
    });
  };
}

/**
 * How both tabs end: text the code, keep any sign-up details for step 2, and
 * go to the code screen. One toast follows the request (see useCodeToast).
 */
export function useRequestCode() {
  const router = useRouter();
  const sendCode = useSendCode();
  const codeToast = useCodeToast();
  const { setDraft } = useAuthFlow();

  const request = (phone: string, draft: SignUpDraft | null) => {
    setDraft(draft);
    codeToast(sendCode.mutateAsync({ phone }), phone).then(
      () => router.push({ pathname: '/verify', query: { phone } }),
      () => undefined,
    );
  };

  return { request, isPending: sendCode.isPending };
}
