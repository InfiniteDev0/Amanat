import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/** Colour of the badge and the number. Neutral uses an outline badge; plain a soft grey one. */
export type StatTone = 'neutral' | 'plain' | 'blue' | 'violet' | 'sky' | 'green' | 'orange' | 'teal' | 'red';

export interface StatCardProps {
  /** Short name in the pill at the top. */
  badge: string;
  /** What leads the pill: an icon (<WalletIcon />) or a flag. */
  icon: ReactNode;
  /** The figure, already formatted (amounts in MoneyText). */
  value: ReactNode;
  /** One line under the number explaining it. */
  caption: ReactNode;
  tone: StatTone;
  /**
   * What a click anywhere on the card does: open the page behind the figure
   * (`href`) or something on this page (`onClick`). `label` names it for
   * screen readers.
   */
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

/** Badge and number colours per tone, light and dark. Neutral keeps the outline badge. */
export const STAT_TONES: Record<StatTone, { badge: string; value: string }> = {
  neutral: { badge: '', value: 'text-foreground' },
  plain: { badge: 'bg-foreground/5 text-foreground', value: 'text-foreground' },
  blue: { badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300', value: 'text-blue-600 dark:text-blue-400' },
  violet: {
    badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    value: 'text-violet-600 dark:text-violet-400',
  },
  sky: { badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300', value: 'text-sky-600 dark:text-sky-400' },
  green: {
    badge: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    value: 'text-green-600 dark:text-green-400',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    value: 'text-orange-600 dark:text-orange-400',
  },
  teal: { badge: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300', value: 'text-teal-600 dark:text-teal-400' },
  red: { badge: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300', value: 'text-red-600 dark:text-red-400' },
};

const CARD_CLASS = 'bg-card flex h-28 min-w-0 flex-col items-start justify-between rounded-xl p-3';

/**
 * A simple figure card: a coloured badge at the top, the number and a
 * one-line caption at the bottom. With an action, a click anywhere on it
 * opens the page behind it. Flat: no shadow, no border.
 */
export function StatCard({ badge, icon, value, caption, tone, action }: StatCardProps) {
  const colours = STAT_TONES[tone];
  const body = (
    <>
      <Badge variant={tone === 'neutral' ? 'outline' : 'default'} className={cn('h-7 max-w-full gap-2 text-[14px]', colours.badge)}>
        {icon}
        <span className="truncate">{badge}</span>
      </Badge>
      <div className="w-full min-w-0">
        <p className={cn('truncate text-3xl leading-none font-semibold tabular-nums', colours.value)}>{value}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">{caption}</p>
      </div>
    </>
  );
  const clickable = cn(CARD_CLASS, 'hover:bg-card/70 focus-visible:ring-ring/50 text-start transition-colors outline-none focus-visible:ring-2');
  if (action && 'onClick' in action) {
    return (
      <button type="button" onClick={action.onClick} aria-label={action.label} className={clickable}>
        {body}
      </button>
    );
  }
  return action ? (
    <Link href={action.href} aria-label={action.label} className={clickable}>
      {body}
    </Link>
  ) : (
    <div className={CARD_CLASS}>{body}</div>
  );
}

/** A card's shape while its figure loads. */
export function StatCardSkeleton() {
  return (
    <div className={CARD_CLASS} aria-hidden>
      <span className="bg-muted h-7 w-28 animate-pulse rounded-full" />
      <div className="w-full">
        <span className="bg-muted block h-7 w-36 animate-pulse rounded-md" />
        <span className="bg-muted mt-2 block h-3 w-24 animate-pulse rounded" />
      </div>
    </div>
  );
}
