'use client';

import type { Notification, NotificationType } from '@sarrif/core';
import {
  AlarmClockIcon,
  ArrowRightLeftIcon,
  BanknoteIcon,
  CalendarClockIcon,
  ClipboardCheckIcon,
  HandCoinsIcon,
  HistoryIcon,
  LockOpenIcon,
  ScaleIcon,
  ShieldIcon,
  SmartphoneIcon,
  Trash2Icon,
  UserPlusIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { ShopBadge } from '@/components/shop-badge';
import { ltr } from '@/lib/ltr';
import { cn } from '@/lib/utils';

/**
 * Each type in its own colour, so the pill says what it's about at a glance.
 * `cta` is its button, tinted like a goey toast's action button. Written out
 * in full so Tailwind sees every class name.
 */
export const KINDS: Record<NotificationType, { icon: LucideIcon; tone: string; cta: string }> = {
  rates_not_set: {
    icon: ArrowRightLeftIcon,
    tone: 'text-amber-600 dark:text-amber-400',
    cta: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25',
  },
  day_not_closed: {
    icon: LockOpenIcon,
    tone: 'text-orange-600 dark:text-orange-400',
    cta: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/25',
  },
  closing_difference: {
    icon: ScaleIcon,
    tone: 'text-red-600 dark:text-red-400',
    cta: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
  },
  daily_summary: {
    icon: ClipboardCheckIcon,
    tone: 'text-emerald-600 dark:text-emerald-400',
    cta: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25',
  },
  large_transaction: {
    icon: BanknoteIcon,
    tone: 'text-violet-600 dark:text-violet-400',
    cta: 'bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/25',
  },
  past_entry_changed: {
    icon: HistoryIcon,
    tone: 'text-pink-600 dark:text-pink-400',
    cta: 'bg-pink-100 text-pink-700 hover:bg-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:hover:bg-pink-500/25',
  },
  entry_deleted: {
    icon: Trash2Icon,
    tone: 'text-rose-600 dark:text-rose-400',
    cta: 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25',
  },
  debt_due: {
    icon: CalendarClockIcon,
    tone: 'text-sky-600 dark:text-sky-400',
    cta: 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/25',
  },
  debt_overdue: {
    icon: AlarmClockIcon,
    tone: 'text-red-600 dark:text-red-400',
    cta: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
  },
  amanat_withdrawal: {
    icon: HandCoinsIcon,
    tone: 'text-teal-600 dark:text-teal-400',
    cta: 'bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:hover:bg-teal-500/25',
  },
  low_balance: {
    icon: WalletIcon,
    tone: 'text-orange-600 dark:text-orange-400',
    cta: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/25',
  },
  invitation_accepted: {
    icon: UserPlusIcon,
    tone: 'text-blue-600 dark:text-blue-400',
    cta: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25',
  },
  role_changed: {
    icon: ShieldIcon,
    tone: 'text-indigo-600 dark:text-indigo-400',
    cta: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25',
  },
  new_device: {
    icon: SmartphoneIcon,
    tone: 'text-red-600 dark:text-red-400',
    cta: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
  },
};

/** The calendar day of a moment, on this device, as `yyyy-mm-dd`. */
export function localDay(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today: the time ("09:00"). Before: "yesterday", "3 days ago", in the viewer's language. */
function useWhen() {
  const locale = useLocale();
  return (createdAt: string, now: Date) => {
    const at = new Date(createdAt);
    if (localDay(at) === localDay(now)) {
      return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
    }
    const days = Math.round((Date.parse(localDay(now)) - Date.parse(localDay(at))) / DAY_MS);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-days, 'day');
  };
}

/** Params that are amounts, dates or codes: kept left to right inside Arabic. */
const LTR_PARAMS = new Set(['amount', 'difference', 'date', 'currencies']);

/**
 * A notification's title and body in the viewer's language, built from its
 * type and params. Rows without params (written before them) show the text
 * they were saved with.
 */
export function useNotificationText() {
  const t = useTranslations('notifications.types');
  return (notification: Notification) => {
    if (!notification.params) return { title: notification.title, body: notification.body };
    const values = Object.fromEntries(
      Object.entries(notification.params).map(([key, value]) => [key, typeof value === 'string' && LTR_PARAMS.has(key) ? ltr(value) : value]),
    );
    return { title: t(`${notification.type}.title`, values), body: t(`${notification.type}.body`, values) };
  };
}

export interface NotificationCardProps {
  notification: Notification;
  /** The shop it's about, shown when you're in more than one. */
  shop: { id: string; name: string } | null;
  now: Date;
  /** Its button: it counts as read, the panel closes, then its page opens. */
  onOpen: () => void;
}

/**
 * One notification, drawn like a goey toast: the icon and title in a pill that
 * flows into the body with a soft curve, the message with the shop and time
 * under it, then the toast's rounded action button. Unread ones carry a dot;
 * read ones fade back but keep their colour.
 */
export function NotificationCard({ notification, shop, now, onOpen }: NotificationCardProps) {
  const t = useTranslations('notifications');
  const when = useWhen();
  const { icon: Icon, tone, cta } = KINDS[notification.type];
  const read = Boolean(notification.readAt);
  const { title, body } = useNotificationText()(notification);

  return (
    <div className={cn('transition-opacity', read && 'opacity-60')}>
      <div className={cn('bg-card relative flex h-[34px] w-fit max-w-[calc(100%-1rem)] items-center gap-2 rounded-t-[17px] ps-2.5 pe-3', tone)}>
        <Icon className="size-[18px] shrink-0" />
        {/* dir="auto": the text is in the receiver's language, which may not be the page's. */}
        <span dir="auto" className="truncate text-[13px] leading-none font-bold">
          {title}
        </span>
        {read ? null : <span aria-label={t('unreadMark')} className="size-1.5 shrink-0 rounded-full bg-current" />}
        {/* The curve from the pill's side down into the body's top edge (mirrored in Arabic). */}
        <span
          aria-hidden
          className="absolute start-full bottom-0 size-3.5 bg-[radial-gradient(circle_at_100%_0,transparent_14px,var(--card)_14.5px)] rtl:bg-[radial-gradient(circle_at_0_0,transparent_14px,var(--card)_14.5px)]"
        />
      </div>

      <div className="bg-card rounded-2xl rounded-ss-none p-3">
        <p dir="auto" className="text-foreground text-start text-[13px] leading-snug">
          {body}
        </p>
        <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[11px] leading-tight">
          {shop ? (
            <>
              <ShopBadge id={shop.id} name={shop.name} className="size-4 rounded text-[9px]" />
              <span className="truncate">{shop.name}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="shrink-0 whitespace-nowrap">{when(notification.createdAt, now)}</span>
        </div>

        {notification.link ? (
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              'mt-3 block w-full rounded-full px-5 py-2.5 text-center text-[13px] font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-current/30',
              cta,
            )}
          >
            {t(`actions.${notification.type}`)}
          </button>
        ) : null}
      </div>
    </div>
  );
}
