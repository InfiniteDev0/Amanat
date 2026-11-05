'use client';

import { LANGUAGES, type Language, passwordSchema, profileSchema } from '@sarrif/core';
import { Check, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Flag } from '@/components/flag';
import { LOCALE_FLAG, useSwitchLocale } from '@/components/locale-switcher';
import { TextField } from '@/components/text-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { phoneInputOf } from '@/features/onboarding/draft';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';
import { cn } from '@/lib/utils';

import { PasswordField } from './password-field';
import { PhoneField } from './phone-field';
import { useCompleteProfile, useSession, useSetNewPassword, useUpdateProfile } from './queries';
import { type PhoneInput, toE164 } from './schemas';

/**
 * Your own account: name, phone and language, and a new password. Someone who
 * signs in only with Google has no password here: "You sign in with Google".
 * Opened from the account menu.
 */
export function AccountSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('me');
  const user = useSession().data;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>
        {/* Mounted fresh on every open, so it starts from the account as it is now. */}
        {open && user ? (
          <div className="flex flex-col gap-8">
            <ProfileSection
              name={user.name}
              phone={user.phone}
              language={user.language}
              onSaved={() => onOpenChange(false)}
            />
            {user.hasPassword === false ? (
              <p className="bg-field text-muted-foreground rounded-xl px-4 py-3 text-sm">{t('googleOnly')}</p>
            ) : (
              <PasswordSection />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProfileSection({ name, phone, language, onSaved }: { name: string; phone: string; language: Language; onSaved: () => void }) {
  const t = useTranslations();
  const message = useMessage();
  const { switchTo } = useSwitchLocale();
  const updateProfile = useUpdateProfile();
  const completeProfile = useCompleteProfile();
  const [draft, setDraft] = useState<{ name: string; phone: PhoneInput; language: Language }>({ name, phone: phoneInputOf(phone), language });
  const [problem, setProblem] = useState<{ field: string; text: string } | null>(null);
  const busy = updateProfile.isPending || completeProfile.isPending;

  const save = () => {
    const checked = profileSchema.shape.name.safeParse(draft.name);
    if (!draft.name.trim()) return setProblem({ field: 'name', text: message('validation.nameRequired') });
    if (!checked.success) return setProblem({ field: 'name', text: message(checked.error.issues[0]?.message ?? 'validation.nameShort') });
    const e164 = toE164(draft.phone);
    if (!e164) return setProblem({ field: 'phone', text: message(draft.phone.number.trim() ? 'validation.phone' : 'validation.phoneRequired') });

    const work = async () => {
      await updateProfile.mutateAsync({ name: checked.data, language: draft.language });
      if (e164 !== phone) await completeProfile.mutateAsync({ phone: e164 });
    };
    promiseToast(work(), {
      loading: t('me.saving'),
      success: () => t('me.saved'),
      error: (error) => message(errorKey(error)),
    }).then(
      () => {
        onSaved();
        if (draft.language !== language) switchTo(draft.language);
      },
      () => undefined,
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <TextField
        id="account-name"
        label={t('onboarding.profile.name')}
        icon={UserRound}
        autoComplete="given-name"
        value={draft.name}
        onChange={(event) => {
          setProblem(null);
          setDraft((d) => ({ ...d, name: event.target.value }));
        }}
        error={problem?.field === 'name' ? problem.text : null}
      />
      <PhoneField
        id="account-phone"
        value={draft.phone}
        onChange={(value) => {
          setProblem(null);
          setDraft((d) => ({ ...d, phone: value }));
        }}
        error={problem?.field === 'phone' ? problem.text : null}
      />
      <div role="radiogroup" aria-label={t('language.label')} className="flex flex-wrap gap-2">
        {LANGUAGES.map((code) => {
          const selected = draft.language === code;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={selected}
              lang={code}
              onClick={() => setDraft((d) => ({ ...d, language: code }))}
              className={cn(
                'flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm transition-colors',
                selected ? 'bg-primary text-primary-foreground' : 'bg-field hover:bg-field-focus',
              )}
            >
              <Flag code={LOCALE_FLAG[code]} />
              {t(`language.${code}`)}
              {selected ? <Check className="size-4" /> : null}
            </button>
          );
        })}
      </div>
      <DialogFooter>
        <Button type="button" onClick={save} disabled={busy} className="h-11 rounded-xl px-5 font-semibold">
          {t('me.save')}
        </Button>
      </DialogFooter>
    </section>
  );
}

function PasswordSection() {
  const t = useTranslations();
  const message = useMessage();
  const setNewPassword = useSetNewPassword();
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const change = () => {
    const checked = passwordSchema.safeParse(password);
    if (!password) return setProblem(message('validation.passwordRequired'));
    if (!checked.success) return setProblem(message(checked.error.issues[0]?.message ?? 'validation.passwordShort'));
    promiseToast(setNewPassword.mutateAsync({ password: checked.data }), {
      loading: t('auth.saving'),
      success: () => t('auth.passwordChanged'),
      error: (error) => message(errorKey(error)),
    }).then(
      () => setPassword(''),
      () => undefined,
    );
  };

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h3 className="text-sm font-semibold">{t('me.password')}</h3>
      <PasswordField
        id="account-new-password"
        label={t('auth.newPassword')}
        autoComplete="new-password"
        meter
        value={password}
        onChange={(event) => {
          setProblem(null);
          setPassword(event.target.value);
        }}
        error={problem}
      />
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={change} disabled={setNewPassword.isPending} className="h-10 rounded-xl px-4">
          {t('me.changePassword')}
        </Button>
      </div>
    </section>
  );
}
