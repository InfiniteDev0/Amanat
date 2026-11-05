'use client';

import { Avatar as HeroAvatar } from '@heroui/react';
import { ChevronDownIcon, GemIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AccountItems } from '@/components/layout/account-items';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AccountSettingsDialog } from '@/features/auth/account-settings-dialog';
import { useSession } from '@/features/auth/queries';
import { SignOutEverywhereDialog } from '@/features/auth/sign-out-everywhere-dialog';
import { PlansDialog } from '@/features/billing/plans-dialog';

/** Your photo, or your first letter on a soft tile. */
function Avatar({ name, src, className }: { name: string; src: string | null; className: string }) {
  return (
    <HeroAvatar className={`${className} rounded-full`}>
      {src ? <HeroAvatar.Image alt="" src={src} className="object-cover" /> : null}
      <HeroAvatar.Fallback className="bg-foreground/10 text-sm font-semibold">{name.trim().charAt(0).toLocaleUpperCase() || '·'}</HeroAvatar.Fallback>
    </HeroAvatar>
  );
}

/**
 * Top-left: you, not a shop (shops live on Home). Your photo, first name and
 * email; the menu holds your own settings: account settings, plan, language,
 * theme, sign out. Its dialogs live outside the menu, which is gone by the
 * time they show.
 */
export function UserMenu() {
  const t = useTranslations();
  const user = useSession().data;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [everywhereOpen, setEverywhereOpen] = useState(false);
  if (!user) return null;
  const firstName = user.name.trim().split(/\s+/)[0] ?? '';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('shell.accountMenu')}
          className="hover:bg-foreground/5 aria-expanded:bg-foreground/5 flex h-11 min-w-0 items-center gap-2.5 rounded-xl px-2 text-start outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <Avatar name={user.name} src={user.avatar} className="size-8 shrink-0" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold">{firstName}</span>
            <span className="text-muted-foreground truncate text-xs">{user.email}</span>
          </span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 rounded-xl border dark:bg-black">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <Avatar name={user.name} src={user.avatar} className="size-10 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">{user.email}</span>
            </div>
          </div>
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuItem className="h-9 gap-2.5" onClick={() => setPlansOpen(true)}>
            <GemIcon />
            {t('shell.plan')}
          </DropdownMenuItem>
          <AccountItems onAccountSettings={() => setSettingsOpen(true)} onSignOutEverywhere={() => setEverywhereOpen(true)} />
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
      <SignOutEverywhereDialog open={everywhereOpen} onOpenChange={setEverywhereOpen} />
    </>
  );
}
