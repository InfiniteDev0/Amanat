import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * A field's error as a small bubble under it, like the browser's own
 * validation message. It floats (absolute), so it never pushes the form
 * down. The field around it must be `relative`. Forms show one at a time.
 */
export function FieldAlert({ id, children, className }: { id?: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      id={id}
      role="alert"
      className={cn(
        // w-fit!: shadcn's Field stretches its children (*:w-full); the bubble hugs its text.
        'bg-foreground text-background animate-in fade-in-0 slide-in-from-top-1 absolute start-0 top-full z-30 mt-2 flex w-fit! max-w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium duration-150',
        className,
      )}
    >
      <span aria-hidden className="bg-foreground absolute -top-1 start-5 size-2 rotate-45" />
      <CircleAlert aria-hidden className="text-destructive size-4 shrink-0" />
      <span className="relative">{children}</span>
    </div>
  );
}
