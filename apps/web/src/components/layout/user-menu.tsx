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
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

/** Account settings and Plan: two quiet buttons side by side under your name (as Barista's). */
const MENU_BUTTON_CLASS =
  'bg-muted hover:bg-accent focus:bg-accent flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium [&_svg]:size-4';

/** Your photo (no-referrer: Google photos refuse some hotlinked requests), or your first letter. */
function Photo({ name, src, className }: { name: string; src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn('bg-foreground/10 relative flex shrink-0 items-center justify-center overflow-hidden rounded-md text-sm font-semibold', className)}>
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
 * Top-left, as Barista's: your photo and name in a pill (no email; shops live
 * on Home, not here). The menu: you (photo, name, your role and email), then
 * Account settings and Plan side by side, then language, theme and sign out.
 * Its dialogs live outside the menu, which is gone by the time they show.
 */
export function NameMenu() {
  const t = useTranslations();
  const user = useSession().data;
  const { role } = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [everywhereOpen, setEverywhereOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('shell.accountMenu')}
          className="hover:bg-muted aria-expanded:bg-muted flex h-9 max-w-80 min-w-0 items-center gap-2.5 rounded-lg bg-black/5 ps-1 pe-2 text-[0.9375rem] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-white/5"
        >
          <Photo name={user.name} src={user.avatar} className="size-7" />
          <span className="truncate">{user.name}</span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="border-border dark:bg-background w-80 rounded-xl border bg-white p-2 shadow-none ring-0">
          <div className="flex items-center gap-3 p-2">
            <Photo name={user.name} src={user.avatar} className="size-11 rounded-xl text-lg" />
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-semibold">{user.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {t(`roles.${role}`)}
                {user.email ? ` · ${user.email}` : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 pt-1">
            <DropdownMenuItem className={MENU_BUTTON_CLASS} onClick={() => setSettingsOpen(true)}>
              <UserRoundCogIcon />
              {t('me.short')}
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_BUTTON_CLASS} onClick={() => setPlansOpen(true)}>
              <GemIcon />
              {t('shell.plan')}
            </DropdownMenuItem>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <AccountItems onSignOutEverywhere={() => setEverywhereOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
      <SignOutEverywhereDialog open={everywhereOpen} onOpenChange={setEverywhereOpen} />
    </>
  );
}
