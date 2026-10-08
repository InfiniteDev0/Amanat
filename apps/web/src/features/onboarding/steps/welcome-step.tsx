'use client';

import { Avatar } from '@heroui/react';
import { gooeyToast } from 'goey-toast';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, useId } from 'react';

import { PenIcon } from '@/components/icons/pen';
import { DEFAULT_AVATAR_URL } from '@/lib/default-avatar';
import { squarePhoto } from '@/lib/square-photo';

import type { StepProps } from '.';
import { StepHeader } from './step-header';

/**
 * The greeting, with their photo on top: a big square avatar (the default
 * picture until one is picked) and a white pen badge to pick one. The photo
 * is saved with the rest of the setup.
 */
export default function WelcomeStep({ draft, update }: StepProps) {
  const t = useTranslations('onboarding.welcome');
  const inputId = useId();
  const firstName = draft.name.trim().split(/\s+/)[0];

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again still fires
    if (!file) return;
    try {
      const avatar = await squarePhoto(file);
      update((d) => ({ ...d, avatar }));
    } catch {
      gooeyToast.error(t('photoFailed'));
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="group relative mb-8">
        <Avatar className="bg-field size-32 rounded-3xl">
          <Avatar.Image alt={t('photoAlt')} src={draft.avatar ?? DEFAULT_AVATAR_URL} className="object-cover" />
          <Avatar.Fallback className="bg-field" />
        </Avatar>
        {/* Undo a wrong pick: back to the default picture. Shows on hover or
            focus; always on touch screens, which have no hover. */}
        {draft.avatar ? (
          <button
            type="button"
            onClick={() => update((d) => ({ ...d, avatar: null }))}
            aria-label={t('removePhoto')}
            className="absolute -inset-e-2 -top-2 flex size-8 items-center justify-center rounded-full bg-white text-black opacity-0 transition group-hover:opacity-100 hover:scale-105 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <X className="size-4" strokeWidth={2.5} />
          </button>
        ) : null}
        <label
          htmlFor={inputId}
          className="absolute -inset-e-2 -bottom-2 flex size-10 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        >
          <PenIcon className="size-5" />
          <span className="sr-only">{draft.avatar ? t('changePhoto') : t('addPhoto')}</span>
        </label>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" />
      </div>
      <StepHeader title={firstName ? t('titleNamed', { name: firstName }) : t('title')} hint={t('hint')} />
    </div>
  );
}
