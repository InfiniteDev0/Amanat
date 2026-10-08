import Image from 'next/image';

import { cn } from '@/lib/utils';

/** The Amanat wordmark (white). On a light background it's inverted to black. */
export function AmanatMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={767}
      height={325}
      className={cn('w-auto shrink-0', !onDark && 'invert dark:invert-0', className)}
    />
  );
}
