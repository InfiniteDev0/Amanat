'use client';

import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useOnline } from '@/lib/use-online';

/** "You're offline" across the top while there's no connection; the forms' buttons wait for it too. */
export function OfflineBanner() {
  const t = useTranslations('auth');
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="bg-foreground text-background flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium">
      <WifiOff aria-hidden className="size-4" />
      {t('offline')}
    </div>
  );
}
