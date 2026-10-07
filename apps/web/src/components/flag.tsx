import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A rectangular flag for any country (ISO 3166 code), no border. The SVGs are
 * static files in /flags (scripts/copy-flags.mjs), so a flag costs nothing
 * until it's on screen. Height comes from `className` (h-3.5 by default).
 */
export function Flag({ code, className }: { code: string; className?: string }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      aria-hidden
      width={21}
      height={14}
      unoptimized
      className={cn('h-3.5 w-auto shrink-0 rounded-xs', className)}
    />
  );
}
