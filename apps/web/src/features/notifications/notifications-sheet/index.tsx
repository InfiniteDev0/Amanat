'use client';

import type { Notification } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { BellOffIcon, CheckCheckIcon, XIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';

import { BellRingIcon } from '@/components/icons/bell-ring-icon';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from '@/i18n/navigation';
import { directionOf } from '@/i18n/routing';
import { cn } from '@/lib/utils';

import { useClearNotifications, useMarkNotificationsRead, useNotifications, useRestoreNotifications } from '../queries';
import { localDay, NotificationCard } from './notification-card';
import { SwipeNotification } from './swipe-notification';
import { type Revealed, SwipeReveal } from './swipe-reveal';

// The card, swiping it on a phone, and sliding it on a computer each live in
// their own file; the bell and its panel here.

const HEADER_BUTTON =
  'text-foreground hover:bg-foreground/10 flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-5';

/**
 * The bell at the end of the top bar, with the unread count, and the panel it
 * opens: toast-like cards from every shop you're in, grouped Today / Earlier
 * with the unread ones first in each. On a phone, swipe a card toward the end
 * to clear it or toward the start to open it; on a computer, drag it to show
 * Clear or Open. The header marks them all read or clears them all (with Undo).
 */
export function NotificationsButton({ className }: { className?: string }) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const isMobile = useIsMobile();
  const notifications = useNotifications();
  const shops = useMyWorkspaces().data ?? [];
  const markRead = useMarkNotificationsRead();
  const clearMutation = useClearNotifications();
  const restore = useRestoreNotifications();
  const [open, setOpen] = React.useState(false);
  // "Today" and the times on the cards, fixed while the panel is open.
  const [now, setNow] = React.useState(() => new Date());
  // Computers: the one card slid open to show its Clear or Open button.
  const [revealed, setRevealed] = React.useState<{ id: string; side: Revealed } | null>(null);

  const rtl = directionOf(locale) === 'rtl';
  const sign = rtl ? -1 : 1;
  const visible = notifications.data ?? [];
  const unread = visible.filter((n) => !n.readAt);
  const shopFor = (n: Notification) => {
    if (shops.length < 2) return null;
    const shop = shops.find(({ workspace }) => workspace.id === n.workspaceId)?.workspace;
    return shop ? { id: shop.id, name: shop.name } : null;
  };

  // Today's first, then earlier ones; in each, the unread ones on top.
  const isToday = (n: Notification) => localDay(new Date(n.createdAt)) === localDay(now);
  const readOnes = visible.filter((n) => n.readAt);
  const shown = [
    ...unread.filter(isToday),
    ...readOnes.filter(isToday),
    ...unread.filter((n) => !isToday(n)),
    ...readOnes.filter((n) => !isToday(n)),
  ];
  // The heading over the first of each group.
  const headings = new Map<string, string>();
  const firstToday = shown.find(isToday);
  const firstEarlier = shown.find((n) => !isToday(n));
  if (firstToday) headings.set(firstToday.id, t('today'));
  if (firstEarlier) headings.set(firstEarlier.id, t('earlier'));

  /** Cleared, with a way back. */
  const clear = (cleared: Notification[]) => {
    const ids = cleared.map(({ id }) => id);
    clearMutation.mutate(ids);
    setRevealed(null);
    gooeyToast.success(cleared.length === 1 ? t('clearedOne', { title: cleared[0]!.title }) : t('clearedMany', { count: cleared.length }), {
      action: { label: t('undo'), successLabel: t('restored'), onClick: () => restore.mutate(ids) },
    });
  };

  /** It counts as read, the panel gets out of the way, then its page opens. */
  const openNotification = (n: Notification) => {
    if (!n.readAt) markRead.mutate([n.id]);
    setOpen(false);
    setRevealed(null);
    if (n.link) router.push(n.link);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNow(new Date());
        else setRevealed(null);
      }}
    >
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label={unread.length > 0 ? t('buttonUnread', { count: unread.length }) : t('button')}
            className={cn(
              'text-foreground/80 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 aria-expanded:bg-foreground/10 dark:bg-white/5 dark:hover:bg-muted dark:aria-expanded:bg-muted relative flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
              className,
            )}
          />
        }
      >
        <BellRingIcon className="size-[18px]" />
        {unread.length > 0 ? (
          <span className="ring-background absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white tabular-nums ring-2">
            {unread.length > 99 ? '99+' : unread.length}
          </span>
        ) : null}
      </SheetTrigger>

      <SheetContent
        // eslint-disable-next-line no-restricted-syntax -- the sheet's side is physical: the end of the page in either direction
        side={rtl ? 'left' : 'right'}
        showCloseButton={false}
        className={cn(
          // A floating panel clear of the screen's edges, flat, a thin border.
          'bg-background border-border my-2 me-2 h-[calc(100svh-1rem)]! w-full gap-0 rounded-3xl border p-0 shadow-none sm:max-w-[26rem]!',
          // Phones: the whole screen.
          'max-md:m-0 max-md:h-svh! max-md:max-w-none! max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]',
        )}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <SheetTitle className="text-lg font-medium tracking-tight">{t('title')}</SheetTitle>
            <SheetDescription className="sr-only">{unread.length > 0 ? t('unread', { count: unread.length }) : t('caughtUp')}</SheetDescription>
          </div>
          <div className="-me-2 flex items-center gap-1">
            <button
              type="button"
              disabled={visible.length === 0}
              onClick={() => clear(visible)}
              className="text-foreground me-1 h-8 rounded-full bg-foreground/5 px-3 text-[13px] font-semibold transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40"
            >
              {t('clearAll')}
            </button>
            <button
              type="button"
              aria-label={t('markAllRead')}
              title={t('markAllRead')}
              disabled={unread.length === 0}
              onClick={() => markRead.mutate(unread.map(({ id }) => id))}
              className={HEADER_BUTTON}
            >
              <CheckCheckIcon />
            </button>
            <SheetClose render={<button type="button" aria-label={t('close')} title={t('close')} className={HEADER_BUTTON} />}>
              <XIcon />
            </SheetClose>
          </div>
        </div>

        {shown.length > 0 ? (
          <ul aria-label={t('title')} className="scrollbar-pill min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-2 pb-8">
            <AnimatePresence initial={false}>
              {shown.map((n) => (
                <motion.li
                  key={n.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
                  className="mb-5 last:mb-0"
                >
                  {headings.has(n.id) ? <h3 className="text-muted-foreground mb-2 px-1 text-sm font-semibold">{headings.get(n.id)}</h3> : null}
                  {isMobile ? (
                    <SwipeNotification sign={sign} onClear={() => clear([n])} onOpen={() => openNotification(n)}>
                      <NotificationCard notification={n} shop={shopFor(n)} now={now} onOpen={() => openNotification(n)} />
                    </SwipeNotification>
                  ) : (
                    <SwipeReveal
                      sign={sign}
                      revealed={revealed?.id === n.id ? revealed.side : null}
                      onRevealChange={(side) => setRevealed(side ? { id: n.id, side } : null)}
                      onClear={() => clear([n])}
                      onOpen={() => openNotification(n)}
                    >
                      <NotificationCard notification={n} shop={shopFor(n)} now={now} onOpen={() => openNotification(n)} />
                    </SwipeReveal>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <span className="bg-card flex size-12 items-center justify-center rounded-full">
              <BellOffIcon className="text-muted-foreground size-5" />
            </span>
            {notifications.isError ? (
              <p className="text-foreground font-medium">{t('loadFailed')}</p>
            ) : (
              <>
                <p className="text-foreground font-medium">{t('caughtUp')}</p>
                <p className="text-muted-foreground max-w-64 text-sm">{t('emptyBody')}</p>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
