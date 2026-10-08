'use client';

import { MapPin, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { TextField } from '@/components/text-field';

import type { StepProps } from '.';
import { StepHeader } from './step-header';

/** The shop's name (what staff and the shop switcher see) and where it is. */
export default function ShopStep({ draft, update, problem }: StepProps) {
  const t = useTranslations('onboarding.shop');
  return (
    <div>
      <StepHeader title={t('title')} hint={t('hint')} />
      <div className="flex flex-col gap-4">
        <TextField
          id="onboarding-shop-name"
          label={t('name')}
          icon={Store}
          autoComplete="off"
          value={draft.shopName}
          onChange={(event) => update((d) => ({ ...d, shopName: event.target.value }))}
          error={problem?.field === 'shopName' ? problem.text : null}
        />
        <TextField
          id="onboarding-location"
          label={t('location')}
          icon={MapPin}
          autoComplete="off"
          value={draft.location}
          onChange={(event) => update((d) => ({ ...d, location: event.target.value }))}
        />
      </div>
    </div>
  );
}
