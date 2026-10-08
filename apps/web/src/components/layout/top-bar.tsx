'use client';

import { CheckIcon, ChevronDownIcon, PlusIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountItems } from '@/components/layout/account-items';
import { NotificationsButton } from '@/features/notifications/notifications-sheet';
import { ShopBadge } from '@/components/shop-badge';
import { useStartNewShop } from '@/features/onboarding/setup-wizard';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { Link, useRouter } from '@/i18n/navigation';

/** Settings and People: two quiet buttons side by side under the shop's name. */
const MENU_BUTTON_CLASS =
  'bg-muted hover:bg-accent focus:bg-accent flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium [&_svg]:size-4';

/**
 * The bar across the top of the app, on the page itself (no panel): which
 * shop you're in, and the menu to another; at the other end, the bell. The
 * menu: the shop (big badge, name, your role and plan), its Settings and
 * People, every shop you're in to switch to, Create shop (opens the setup
 * wizard), then your language, theme and sign out.
 */
export function TopBar({ workspaceId, shopName }: { workspaceId: string; shopName: string }) {
  const t = useTranslations();
  const router = useRouter();
  const startNewShop = useStartNewShop();
  const shops = useMyWorkspaces().data ?? [];
  const role = shops.find(({ workspace }) => workspace.id === workspaceId)?.role;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('shell.switchShop')}
          className="hover:bg-muted aria-expanded:bg-muted flex h-8 max-w-80 items-center gap-2.5 rounded-md bg-white/5 px-1 text-[15px] font-semibold transition-colors"
        >
          <ShopBadge id={workspaceId} name={shopName} />
          <span className="truncate">{shopName}</span>
          <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="border-border bg-black w-80 rounded-xl border p-2 shadow-none ring-0">
          <div className="flex items-center gap-3 p-2">
            <ShopBadge id={workspaceId} name={shopName} className="size-11 rounded-xl text-lg" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{shopName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {role ? `${t(`roles.${role}`)} · ` : ''}
                {t('brand.plan')}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 pt-1">
            <DropdownMenuItem className={MENU_BUTTON_CLASS} render={<Link href={`/w/${workspaceId}/settings`} />}>
              <SettingsIcon />
              {t('nav.settings')}
            </DropdownMenuItem>
            <DropdownMenuItem className={MENU_BUTTON_CLASS} render={<Link href={`/w/${workspaceId}/team`} />}>
              <UsersIcon />
              {t('shell.people')}
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-muted-foreground text-xs">{t('shell.switchShops')}</DropdownMenuLabel>
            {shops.map(({ workspace }) => (
              <DropdownMenuItem key={workspace.id} className="h-9 gap-2.5" onClick={() => router.push(`/w/${workspace.id}`)}>
                <ShopBadge id={workspace.id} name={workspace.name} />
                <span className="flex-1 truncate">{workspace.name}</span>
                {workspace.id === workspaceId ? <CheckIcon className="ms-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuItem className="text-muted-foreground h-9 gap-2.5" onClick={startNewShop}>
            <span className="border-border flex size-6 items-center justify-center rounded-md border border-dashed">
              <PlusIcon className="size-3.5" />
            </span>
            {t('shell.createShop')}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <AccountItems />
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationsButton className="ms-auto" />
    </div>
  );
}
