'use client';

import { useTranslations } from 'next-intl';

import { Splash } from '@/features/auth/session-gate';
import { Link } from '@/i18n/navigation';

/** A shop that isn't yours (or doesn't exist; the two look the same): say so, and the way back Home. */
export function NoAccess() {
  const t = useTranslations();
  return (
    <Splash>
      <div className="flex flex-col items-center gap-4">
        <p>{t('common.noAccess')}</p>
        <Link href="/home" className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-semibold">
          {t('shop.back')}
        </Link>
      </div>
    </Splash>
  );
}
