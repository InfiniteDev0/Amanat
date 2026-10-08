import { cn } from '@/lib/utils';

/** A steady colour per shop, so each one is recognisable at a glance. */
const SHOP_COLOURS = ['bg-teal-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-emerald-600'];

function colourFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return SHOP_COLOURS[hash % SHOP_COLOURS.length];
}

/** The shop's first letter in its colour. */
export function ShopBadge({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white', colourFor(id), className)}
    >
      {name.trim().charAt(0).toLocaleUpperCase() || '·'}
    </span>
  );
}
