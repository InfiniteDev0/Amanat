'use client';

import { LANGUAGES, type Language } from '@sarrif/core';
import { Check, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Flag } from '@/components/flag';
import { LOCALE_FLAG, useSwitchLocale } from '@/components/locale-switcher';
import { TextField } from '@/components/text-field';
import { cn } from '@/lib/utils';

import type { StepProps } from '.';
import { StepHeader } from './step-header';

/** Name and language. Picking a language switches the app to it right away. */
export default function ProfileStep({ draft, update, problem }: StepProps) {
  const t = useTranslations();
  const { switchTo } = useSwitchLocale();

  const pick = (language: Language) => {
    update((d) => ({ ...d, language })); // saved before the page reloads in the new language
    switchTo(language);
  };

  return (
    <div>
      <StepHeader title={t('onboarding.profile.title')} hint={t('onboarding.profile.hint')} />
      <div className="flex flex-col gap-6">
        <TextField
          id="onboarding-name"
          label={t('onboarding.profile.name')}
          icon={UserRound}
          autoComplete="off"
          value={draft.name}
          onChange={(event) => update((d) => ({ ...d, name: event.target.value }))}
          error={problem?.field === 'name' ? problem.text : null}
        />

        <div role="radiogroup" aria-label={t('language.label')} className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">{t('language.label')}</p>
          {LANGUAGES.map((language) => {
            const selected = draft.language === language;
            return (
              <button
                key={language}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={language}
                onClick={() => pick(language)}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-xl px-4 text-sm transition-colors',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-field hover:bg-field-focus',
                )}
              >
                <Flag code={LOCALE_FLAG[language]} />
                <span className="flex-1 text-start">{t(`language.${language}`)}</span>
                {selected ? <Check className="size-4" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
