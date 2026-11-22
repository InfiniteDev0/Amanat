'use client';

import { MoonIcon, SearchIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, Suspense, useEffect, useSyncExternalStore } from 'react';

// The shop menu is off: shops live on Home now, and top-left is your name.
// import { ShopMenu } from '@/components/layout/shop-menu';
import { NameMenu } from '@/components/layout/user-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActivityButton } from '@/features/activity/activity-sheet';
import { NotificationsButton } from '@/features/notifications/notifications-sheet';
import { CommandPalette, useCommandPalette } from '@/features/search/command-palette';
import { useTheme } from '@/features/theme/use-theme';
import { cn } from '@/lib/utils';
// The day picker is off for now; it comes back with the import and the block below.
// import { SidebarDay } from '@/features/workspaces/sidebar-day';

/** The bar's icons, as Barista's: just the grey icon, a soft square only under the pointer. */
export const BAR_ICON =
  'flex size-8 items-center justify-center rounded-md bg-transparent text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 dark:hover:bg-white/10 [&_svg]:size-[1.125rem]';

/** Light and dark: a larger icon in the same button. */
const BAR_ICON_LARGE = `${BAR_ICON} [&_svg]:size-5!`;

/** Ctrl K, or ⌘K on a Mac. */
function useShortcutLabel() {
  const t = useTranslations('search');
  const mac = useSyncExternalStore(
    () => () => undefined,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  return mac ? t('shortcutMac') : t('shortcut');
}

/** Light or dark: the sun and moon crossing over with the theme. D flips it from anywhere. */
function ThemeToggle() {
  const t = useTranslations('theme');
  const { theme, setTheme } = useTheme();
  const flip = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'd') return;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTheme]);

  return (
    <Tooltip>
      <TooltipTrigger render={<button type="button" aria-label={t('toggle')} aria-keyshortcuts="D" onClick={flip} className={cn(BAR_ICON_LARGE, 'relative')} />}>
        {/* Both are always there; one turns in as the other turns out. */}
        <SunIcon className="rotate-0 scale-100 transition-transform duration-300 ease-out dark:-rotate-90 dark:scale-0" />
        <MoonIcon className="absolute rotate-90 scale-0 transition-transform duration-300 ease-out dark:rotate-0 dark:scale-100" />
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {t('toggle')} · D
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The strip across the top, as Barista's: no shape of its own, straight on
 * the page. Your account and its menu, then the activity log; search in the
 * middle (and Ctrl+K anywhere); light/dark and the bell at the other end. No
 * breadcrumb: the sidebar says where you are.
 */
export function TopBar({ title: _title }: { title?: ReactNode }) {
  const t = useTranslations('search');
  const shortcut = useShortcutLabel();
  const palette = useCommandPalette();

  return (
    <div className="relative flex h-12 shrink-0 items-center gap-2 px-2">
      <NameMenu />

      {/* After the account: the activity log. */}
      <div className="ms-1">
        <Suspense fallback={null}>
          <ActivityButton className={BAR_ICON} />
        </Suspense>
      </div>

      {/* Search, in the middle of the bar; wide screens only. */}
      <div className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex">
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          aria-keyshortcuts="Control+K"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 pointer-events-auto flex h-9 w-[22rem] items-center gap-2.5 rounded-xl bg-black/5 px-3 text-sm outline-none transition-colors hover:bg-black/[0.08] xl:w-96 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="flex-1 text-start">{t('placeholder')}</span>
          <span className="text-muted-foreground/80 text-xs font-medium">{shortcut}</span>
        </button>
      </div>

      {/* The day picker, off for now.
      <Suspense fallback={null}>
        <SidebarDay />
      </Suspense> */}

      <div className="ms-auto flex shrink-0 items-center gap-1">
        {/* Narrow screens: search as an icon. */}
        <button type="button" onClick={() => palette.setOpen(true)} aria-label={t('placeholder')} className={cn(BAR_ICON, 'lg:hidden')}>
          <SearchIcon />
        </button>
        <ThemeToggle />
        <NotificationsButton className={BAR_ICON} />
      </div>

      <CommandPalette open={palette.open} onClose={() => palette.setOpen(false)} />
    </div>
  );
}
