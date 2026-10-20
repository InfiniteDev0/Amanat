import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** What went wrong with the whole form ("Email or password is wrong"), under its button. Already translated. */
export function FormError({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div role="alert" className={cn('text-destructive flex items-start gap-2 text-sm', className)}>
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
