'use client';

import { ChevronDownIcon, GemIcon, UserRoundCogIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AccountItems } from '@/components/layout/account-items';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccountSettingsDialog } from '@/features/auth/account-settings-dialog';
import { useSession } from '@/features/auth/queries';
import { SignOutEverywhereDialog } from '@/features/auth/sign-out-everywhere-dialog';
import { PlansDialog } from '@/features/billing/plans-dialog';
import { cn } from '@/lib/utils';

// The top bar's two ends, like Milo's (and ClickUp's): your name in a small
// pill at the start, your photo at the very end. No email, nothing bigger.

const MENU_CLASS = 'w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-border p-1.5 shadow-xl ring-0 dark:bg-[#161616]';

/** Your photo (no-referrer: Google photos refuse some hotlinked requests), or your first letter. */
function Photo({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn('bg-foreground/10 relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm text-[11px] font-semibold', className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a plain img so a failed load can drop to the letter
        <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        (name.trim().charAt(0).toLocaleUpperCase() || '·')
      )}
    </span>
  );
}

/**
 * Top-left: your name in a pill (shops live on Home, not here). Its menu:
 * your name big, Account settings and Plan.
 */
export function NameMenu() {
  const t = useTranslations();
  const user = useSession().data;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('shell.accountMenu')}
          className="hover:bg-muted aria-expanded:bg-muted flex h-8 max-w-56 min-w-0 items-center gap-2 rounded-sm bg-black/5 ps-1.5 pe-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 xl:max-w-80 dark:bg-white/5"
        >
          <Photo name={user.name} src={user.avatar} className="size-5" />
          <span className="truncate">{user.name}</span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8} className={MENU_CLASS}>
          <div className="flex items-center gap-3 p-2">
            <Photo name={user.name} src={user.avatar} className="size-10 text-base" />
            <p className="min-w-0 truncate text-[17px] font-semibold">{user.name}</p>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem className="h-9 gap-2.5" onClick={() => setSettingsOpen(true)}>
            <UserRoundCogIcon />
            {t('me.menu')}
          </DropdownMenuItem>
          <DropdownMenuItem className="h-9 gap-2.5" onClick={() => setPlansOpen(true)}>
            <GemIcon />
            {t('shell.plan')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
}

/** The very end of the top bar: your photo. Its menu: who's signed in, language, theme, sign out. */
export function AvatarMenu() {
  const t = useTranslations();
  const user = useSession().data;
  const [everywhereOpen, setEverywhereOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('shell.you')}
          className="text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted flex items-center gap-0.5 rounded-sm p-0.5 pe-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <Photo name={user.name} src={user.avatar} className="size-6" />
          <ChevronDownIcon className="size-3.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className={MENU_CLASS}>
          <div className="flex items-center gap-3 p-2">
            <Photo name={user.name} src={user.avatar} className="size-9 text-sm" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            </div>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <AccountItems onSignOutEverywhere={() => setEverywhereOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutEverywhereDialog open={everywhereOpen} onOpenChange={setEverywhereOpen} />
    </>
  );
}
