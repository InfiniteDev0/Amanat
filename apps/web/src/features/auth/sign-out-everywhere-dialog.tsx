'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';

import { useSignOutAndLeave } from './use-sign-out-and-leave';

/**
 * "Sign out of all devices?" for a lost or stolen phone: every session of
 * this account ends, here and on every other device (they're sent to log in
 * on their next click). Opened from the account items in the shop menu.
 */
export function SignOutEverywhereDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('auth.everywhere');
  const signOut = useSignOutAndLeave();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('body')}</DialogDescription>
        <DialogFooter>
          <Button variant="ghost" className="h-10 rounded-xl" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            className="h-10 rounded-xl font-semibold"
            onClick={() => {
              onOpenChange(false);
              signOut({ everywhere: true });
            }}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
