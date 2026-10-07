'use client';

import { InputOTP } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Loader } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { saveSignupCurrencies } from '@/features/onboarding/signup-currencies';
import { Link, useRouter } from '@/i18n/navigation';
import { errorKey, useMessage } from '@/lib/api/errors';
import { ltr } from '@/lib/ltr';

import { useAuthFlow } from './auth-flow';
import { homePathFor } from './home-path';
import { useSendCode, useVerifyCode } from './queries';

/** Seconds before another code can be sent. Each SMS costs money. */
const RESEND_COOLDOWN_S = 30;

const SLOT_CLASS =
  'h-12 rounded-xl text-lg data-[invalid=true]:text-destructive data-[invalid=true]:outline-none';

/** Step 2: the 6-digit code. Typing the last digit submits it. */
export function CodeForm({ phone }: { phone: string }) {
  const t = useTranslations();
  const message = useMessage();
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draft } = useAuthFlow();
  const verify = useVerifyCode();
  const resend = useSendCode();
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = verify.isPending || leaving;
  // Sign-up details belong to the number they were typed with.
  const signUp = draft?.phone === phone ? draft : null;

  // The field is disabled while a code is checked, which drops focus. Take it
  // back as soon as it's usable, so after a wrong code you just type again.
  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = (value: string) => {
    verify.mutate(
      { phone, code: value, profile: signUp?.profile },
      {
        onSuccess: async ({ user, isNewUser }) => {
          setLeaving(true);
          if (isNewUser && signUp) saveSignupCurrencies(signUp.currencies);
          const path = await homePathFor(user, queryClient);
          if (!isNewUser) gooeyToast.success(t('auth.welcomeBack', { name: user.name.split(' ')[0] ?? user.name }));
          // Returning users get the app in the language they chose; new ones keep this page's.
          router.replace(path, { locale: isNewUser ? locale : user.language });
        },
        onError: () => setCode(''),
      },
    );
  };

  const sendAgain = () => {
    resend.mutate(
      { phone },
      {
        onSuccess: () => {
          setCooldown(RESEND_COOLDOWN_S);
          gooeyToast.success(t('auth.codeSent'));
        },
      },
    );
  };

  const error = verify.error ?? resend.error;
  const pretty = parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;

  return (
    <form
      className="mx-auto w-full max-w-100 pt-[6vh] pb-10"
      onSubmit={(event) => {
        event.preventDefault();
        if (code.length === 6) submit(code);
      }}
    >
      <h1 className="font-heading text-center text-3xl font-bold tracking-tight">{t('auth.codeTitle')}</h1>
      <p className="text-muted-foreground mt-2 text-center text-sm leading-relaxed">
        {t('auth.codeSubtitle', { phone: ltr(pretty) })}
      </p>

      <div dir="ltr" className="mt-8">
        <InputOTP
          ref={inputRef}
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={submit}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          isDisabled={busy}
          isInvalid={Boolean(verify.error)}
          aria-label={t('auth.code')}
          className="gap-3"
        >
          <InputOTP.Group className="flex-1">
            {[0, 1, 2].map((index) => (
              <InputOTP.Slot key={index} index={index} className={SLOT_CLASS} />
            ))}
          </InputOTP.Group>
          <InputOTP.Separator className="bg-muted-foreground/40 w-3" />
          <InputOTP.Group className="flex-1">
            {[3, 4, 5].map((index) => (
              <InputOTP.Slot key={index} index={index} className={SLOT_CLASS} />
            ))}
          </InputOTP.Group>
        </InputOTP>
      </div>

      {error ? <p className="text-destructive mt-3 text-xs">{message(errorKey(error))}</p> : null}

      <Button type="submit" className="mt-6 h-11 w-full rounded-xl font-semibold" disabled={busy || code.length < 6}>
        {busy ? (
          <>
            <Loader className="animate-spin" size={16} />
            {t('auth.verifying')}
          </>
        ) : (
          t('auth.continue')
        )}
      </Button>

      <div className="mt-5 flex items-center justify-between gap-4 text-sm">
        <button
          type="button"
          onClick={sendAgain}
          disabled={cooldown > 0 || resend.isPending || busy}
          className="text-foreground underline underline-offset-4 transition hover:opacity-70 disabled:no-underline disabled:opacity-50"
        >
          {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
        </button>
        <Link href="/" className="bg-field hover:bg-field-focus rounded-xl px-4 py-2.5 font-medium transition-colors">
          {t('auth.changeNumber')}
        </Link>
      </div>
    </form>
  );
}
