'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useSyncExternalStore } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { BellRingIcon } from '@/components/icons/bell-ring-icon';
import { BAR_ICON } from '@/components/layout/top-bar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getLastWorkspaceId } from '@/features/workspaces/last-workspace';
import { directionOf } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * The app while it starts, as Barista's: never dots on a blank page, but the
 * frame itself, all of it real and where it will stay (the sidebar with its
 * pages, the activity clock, light/dark and the bell) except your account,
 * with a sheen running over it, and search, a shimmering bar. The main panel
 * is empty until the page draws in it.
 */

/** A sheen travelling across whatever it's on. */
export const SHEEN =
  'relative overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer-sweep_1.6s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/55 after:to-transparent dark:after:via-white/[0.08]';

/** Your name, kept from last time (the name menu keeps it), so it shows while you're checked. */
export const NAME_KEY = 'amanat.name';

const never = () => () => undefined;
const readName = () => {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};
const readSidebarOpen = () => document.cookie.split('; ').includes('sidebar_state=true');

/** The activity clock, as the bar has it (not yet a button). */
function ActivityGlyph() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.905 2.905C2.021 3.79 1.5 5.138 1.5 7c0 1.862 0.521 3.21 1.405 4.095C3.79 11.979 5.138 12.5 7 12.5c2.365 0 3.915 -0.836 4.742 -2.246a0.75 0.75 0 0 1 1.293 0.759C11.867 13.005 9.738 14 7 14c-2.138 0 -3.914 -0.604 -5.155 -1.845C0.604 10.915 0 9.138 0 7c0 -2.138 0.604 -3.914 1.845 -5.155C3.085 0.604 4.862 0 7 0h0.006c0.32 0.003 1.144 0.03 1.65 0.144a0.75 0.75 0 1 1 -0.328 1.463c-0.33 -0.074 -1.004 -0.104 -1.331 -0.107 -1.86 0 -3.208 0.522 -4.092 1.405Zm8.206 -1.716a0.75 0.75 0 0 0 -0.675 1.34c0.483 0.243 0.87 0.577 1.167 0.995a0.75 0.75 0 0 0 1.224 -0.867 4.632 4.632 0 0 0 -1.716 -1.468Zm1.29 6.969a0.75 0.75 0 0 0 1.48 0.247A8.54 8.54 0 0 0 13.99 7c0 -0.49 -0.037 -0.96 -0.11 -1.405a0.75 0.75 0 0 0 -1.48 0.247c0.06 0.356 0.09 0.741 0.09 1.158 0 0.417 -0.03 0.802 -0.09 1.158ZM7.75 4.75a0.75 0.75 0 0 0 -1.5 0v2.5c0 0.18 0.064 0.352 0.18 0.488l2.062 2.403a0.75 0.75 0 0 0 1.139 -0.977L7.75 6.972V4.75Z"
      />
    </svg>
  );
}

export function FrameLoading() {
  const t = useTranslations('common');
  const dir = directionOf(useLocale());
  const name = useSyncExternalStore(never, readName, () => '');
  const open = useSyncExternalStore(never, readSidebarOpen, () => false);
  const shopId = useSyncExternalStore(never, () => getLastWorkspaceId() ?? '', () => '');
  const icon = (className: string, children: React.ReactNode) => <span className={cn(BAR_ICON, 'hover:bg-transparent', className)}>{children}</span>;

  return (
    <div role="status" aria-label={t('loading')} className="bg-background flex h-svh flex-col overflow-hidden">
      {/* The top bar, as TopBar draws it. */}
      <div className="relative flex h-12 shrink-0 items-center gap-2 px-2">
        <span className={cn('flex h-9 max-w-80 min-w-0 items-center gap-2.5 rounded-lg bg-black/5 ps-1 pe-2 text-[0.9375rem] font-semibold dark:bg-white/5', SHEEN)}>
          <span className="bg-foreground/10 flex size-7 shrink-0 items-center justify-center rounded-md text-sm">{name.trim().charAt(0).toLocaleUpperCase()}</span>
          {name ? <span className="truncate">{name}</span> : <span className="bg-foreground/10 h-3.5 w-20 rounded-full" />}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted-foreground size-4 shrink-0">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <div className="ms-1">{icon('[&_svg]:size-[17px]!', <ActivityGlyph />)}</div>

        <div className="pointer-events-none absolute inset-x-0 hidden justify-center lg:flex">
          <span className={cn('h-9 w-[22rem] rounded-xl bg-black/5 xl:w-96 dark:bg-white/5', SHEEN)} />
        </div>

        <div className="ms-auto flex items-center gap-1">
          {icon(
            'relative [&_svg]:size-5!',
            <>
              <SunIcon className="dark:hidden" />
              <MoonIcon className="hidden dark:block" />
            </>,
          )}
          {icon('', <BellRingIcon className="size-4" />)}
        </div>
      </div>

      {/* The sidebar, open or folded as it was left, and the empty panel. */}
      <SidebarProvider
        // Remounted once this browser's choice is read: open or folded as it was left.
        key={String(open)}
        defaultOpen={open}
        className="min-h-0 flex-1"
        style={{ '--sidebar-width': 'calc(var(--spacing) * 72)', '--sidebar-width-icon': 'calc(var(--spacing) * 14)' } as CSSProperties}
      >
        <AppSidebar still variant="inset" dir={dir} workspaceId={shopId} className="top-12 bottom-0 h-auto pt-0" />
        <SidebarInset className="border-border mt-0! min-h-0 overflow-hidden rounded-sm! border" />
      </SidebarProvider>
    </div>
  );
}
