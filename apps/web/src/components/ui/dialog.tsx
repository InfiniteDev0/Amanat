'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

// A centred dialog on Base UI: a dimmed, blurred page behind a flat rounded
// panel with a thin border and no shadow. In dark mode the panel is the card
// colour and the fields inside it are re-pointed a step lighter (scoped
// --field-background), so they still show on it.

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogContent({
  className,
  children,
  closeLabel,
  showCloseButton,
  ...props
}: DialogPrimitive.Popup.Props & {
  /** The close button's accessible name; no button without it. */
  closeLabel?: string;
  /** shadcn's switch for the close button (used by registry components): on, it shows with closeLabel or "Close". */
  showCloseButton?: boolean;
}) {
  const close = closeLabel ?? (showCloseButton ? 'Close' : null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'bg-popover dark:bg-card text-popover-foreground border-border fixed top-1/2 left-1/2 z-50 flex max-h-[min(720px,92svh)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border p-6 outline-none',
          'dark:[--field-background:oklch(0.26_0_0)] dark:[--field-focus:oklch(0.3_0_0)]',
          'transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
          className,
        )}
        {...props}
      >
        {children}
        {close ? (
          <DialogPrimitive.Close
            aria-label={close}
            className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground absolute end-4 top-4 flex size-9 items-center justify-center rounded-full transition-colors"
          >
            <XIcon className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/** The title and description, stacked (shadcn's layout, for registry components). */
function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1 text-start', className)} {...props} />;
}

/** The buttons at the end, side by side from the end (shadcn's layout). */
function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn('text-lg font-medium', className)} {...props} />;
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn('text-muted-foreground mt-1 text-sm', className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
