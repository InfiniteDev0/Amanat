'use client';

import { XIcon } from 'lucide-react';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { directionOf } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const CLOSE_BUTTON =
  'text-foreground hover:bg-foreground/10 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 [&_svg]:size-5';

/**
 * The sheet every action opens in (an expense, a swap, a move…), dressed like
 * the notifications panel: a clean floating panel at the end of the screen,
 * clear of its edges, the page behind it blurred; the whole screen on a
 * phone. A title and a close button at the top, then the form, which scrolls.
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** For screen readers: what the sheet is for. */
  description?: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const rtl = directionOf(useLocale()) === 'rtl';
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // eslint-disable-next-line no-restricted-syntax -- the sheet's side is physical: the end of the page in either direction
        side={rtl ? 'left' : 'right'}
        showCloseButton={false}
        className={cn(
          'bg-background border-border my-2 me-2 h-[calc(100svh-1rem)]! w-full gap-0 rounded-3xl border p-0 shadow-none sm:max-w-[26rem]!',
          'max-md:m-0 max-md:h-svh! max-md:max-w-none! max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
          <SheetTitle className="text-lg font-medium tracking-tight">{title}</SheetTitle>
          {description ? <SheetDescription className="sr-only">{description}</SheetDescription> : null}
          <SheetClose render={<button type="button" aria-label={closeLabel} title={closeLabel} className={cn(CLOSE_BUTTON, '-me-2')} />}>
            <XIcon />
          </SheetClose>
        </div>
        <div className="scrollbar-pill min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 pt-2 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
