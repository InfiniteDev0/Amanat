'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';

/**
 * Runs `open` once when the address asks for `action` (?do=set-rates), then
 * takes it out of the address so a reload doesn't open it again. How a
 * notification's button starts a task on another page.
 */
export function useOpenFromAddress(action: string, open: () => void) {
  const asked = useSearchParams().get('do');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (asked !== action) return;
    open();
    router.replace(pathname);
    // Only when the address asks; `open` is a fresh function every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, action]);
}
