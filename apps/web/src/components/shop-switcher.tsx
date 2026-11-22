'use client';

import { CheckIcon, ChevronsUpDownIcon, CircleArrowUpIcon, LayoutGridIcon, LogOutIcon, MailIcon, PlusIcon, SettingsIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { ShopBadge } from '@/components/shop-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSession } from '@/features/auth/queries';
import { useSignOutAndLeave } from '@/features/auth/use-sign-out-and-leave';
import { PlansDialog } from '@/features/billing/plans-dialog';
import { NewShopDialog } from '@/features/home/new-shop-dialog';
import { PeopleDialog } from '@/features/team/people-dialog';
import { useTeam } from '@/features/team/queries';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { setShopScope, useShopScope } from '@/features/workspaces/shop-scope';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/*
 * The shop switcher, at the foot of the sidebar, as Notion's workspaces: the
 * shop you're in (or All shops) with ⇅. Open: that shop at the top (its
 * badge, name, "Free Plan · 1 member"), then Upgrade, Settings and Invite
 * members; under your email, All shops and each of your shops (a tick on the
 * one you're in) and + New shop; then Log out. Picking a shop shows only it
 * everywhere, from Home to Trash; the page you're on opens for that shop.
 */

const ITEM = 'gap-3 rounded-md px-2.5 py-2 text-[15px] [&_svg]:size-4.5';

function MemberCount({ shopId }: { shopId: string }) {
  const t = useTranslations('switcher');
  const team = useTeam(shopId).data;
  // Until the team is in the database the list comes back empty: there's you.
  const count = Math.max(1, team?.members.length ?? 1);
  return <>{t('planMembers', { count })}</>;
}

export function ShopSwitcher() {
  const t = useTranslations('switcher');
  const router = useRouter();
  const pathname = usePathname();
  const user = useSession().data;
  const shops = useMyWorkspaces().data ?? [];
  const scope = useShopScope();
  const signOut = useSignOutAndLeave();
  const [plans, setPlans] = useState(false);
  const [people, setPeople] = useState(false);
  const [adding, setAdding] = useState(false);

  // The shop you're in: the one in the address, else the one picked.
  const inAddress = /^\/w\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const currentId = inAddress ?? (scope === 'all' ? null : scope);
  const current = shops.find((m) => m.workspace.id === currentId) ?? null;
  const main = shops.find((m) => m.workspace.isMain) ?? shops[0];
  // The shop the menu's top (Settings, Invite) is about: the current one, or the main shop for All.
  const about = current ?? main;

  const pick = (id: string | 'all') => {
    setShopScope(id);
    if (id === 'all') {
      // Every shop together: Home and Amanat show them all; a page of one shop goes back Home.
      if (inAddress && !pathname.endsWith('/amanat')) router.push('/home');
      return;
    }
    // The same page, for that shop.
    if (inAddress) router.push(pathname.replace(/^\/w\/[^/]+/, `/w/${id}`));
  };

  if (!about) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('label')}
          className="hover:bg-white/10 aria-expanded:bg-white/10 flex h-12 w-full items-center gap-2.5 rounded-md px-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
        >
          {current ? (
            <ShopBadge id={current.workspace.id} name={current.workspace.name} className="size-7 shrink-0 rounded-md text-sm" />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15">
              <LayoutGridIcon className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">{current ? current.workspace.name : t('allShops')}</span>
          <ChevronsUpDownIcon className="text-sidebar-foreground/60 size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-80 rounded-xl border p-1.5 dark:bg-[#1f1f1f]">
          {/* The shop at the top: its badge, name, plan and members. */}
          <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
            <ShopBadge id={about.workspace.id} name={about.workspace.name} className="size-11 shrink-0 rounded-lg text-lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{current ? current.workspace.name : t('allShops')}</p>
              <p className="text-muted-foreground truncate text-[13px]">
                {current ? <MemberCount shopId={current.workspace.id} /> : t('shopsCount', { count: shops.length })}
              </p>
            </div>
          </div>
          <DropdownMenuItem className={cn(ITEM, 'text-[#2f80ed] [&_svg]:text-[#2f80ed]')} onClick={() => setPlans(true)}>
            <CircleArrowUpIcon />
            {t('upgrade')}
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} onClick={() => router.push(`/w/${about.workspace.id}/settings`)}>
            <SettingsIcon />
            {t('settings')}
          </DropdownMenuItem>
          <DropdownMenuItem className={ITEM} onClick={() => setPeople(true)}>
            <MailIcon />
            {t('invite')}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />
          {/* Under your email: every shop together, then each of yours. */}
          {user?.email ? <p className="text-muted-foreground truncate px-2.5 pt-1 pb-1.5 text-[13px] font-medium">{user.email}</p> : null}
          <DropdownMenuItem className={ITEM} onClick={() => pick('all')}>
            <span className="bg-foreground/10 flex size-6 shrink-0 items-center justify-center rounded-md">
              <LayoutGridIcon className="size-3.5!" />
            </span>
            <span className="min-w-0 flex-1 truncate">{t('allShops')}</span>
            {current ? null : <CheckIcon />}
          </DropdownMenuItem>
          {shops.map(({ workspace }) => (
            <DropdownMenuItem key={workspace.id} className={ITEM} onClick={() => pick(workspace.id)}>
              <ShopBadge id={workspace.id} name={workspace.name} className="size-6 shrink-0 rounded-md text-xs" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.isMain ? <span className="shrink-0 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-500">{t('main')}</span> : null}
              {current?.workspace.id === workspace.id ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem className={cn(ITEM, 'text-[#2f80ed] [&_svg]:text-[#2f80ed]')} onClick={() => setAdding(true)}>
            <PlusIcon />
            {t('newShop')}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem className={cn(ITEM, 'text-muted-foreground')} onClick={() => signOut()}>
            <LogOutIcon />
            {t('logOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PlansDialog open={plans} onOpenChange={setPlans} />
      <WorkspaceProvider workspace={about.workspace} role={about.role}>
        <PeopleDialog open={people} onOpenChange={setPeople} />
      </WorkspaceProvider>
      {main ? <NewShopDialog open={adding} onOpenChange={setAdding} main={main.workspace} /> : null}
    </>
  );
}
