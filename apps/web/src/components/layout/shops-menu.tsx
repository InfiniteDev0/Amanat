'use client';

import { CheckIcon, LayoutGridIcon, MailIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { ShopBadge } from '@/components/shop-badge';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useTeam } from '@/features/team/queries';
import { useMyWorkspaces } from '@/features/workspaces/queries';
import { setShopScope, useShopScope } from '@/features/workspaces/shop-scope';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// The shops part of the name menu, as Notion's workspaces: Invite members for
// the shop in view, then All shops and each of your shops with its tick, and
// + New shop. Tick one shop or several: Home and Amanat show only the ticked
// ones, and a page of one shop (Profit, Settings…) opens for a ticked shop.
// The menu stays open while you tick. Its dialogs live outside the menu.

const ITEM = 'h-9 gap-2.5';

/** What's ticked, the one shop in view, and the ways to change it. */
export function useShopTicks() {
  const router = useRouter();
  const pathname = usePathname();
  const shops = useMyWorkspaces().data ?? [];
  const scope = useShopScope();
  const inAddress = /^\/w\/([^/]+)/.exec(pathname)?.[1] ?? null;
  const main = shops.find((m) => m.workspace.isMain) ?? shops[0];
  const ticked = scope === 'all' ? shops.map((m) => m.workspace.id) : scope.filter((id) => shops.some((m) => m.workspace.id === id));
  const everything = scope === 'all' || ticked.length === shops.length;
  const single = ticked.length === 1 ? shops.find((m) => m.workspace.id === ticked[0]) : undefined;
  // The shop Invite members is for: the only one ticked, else the one in the address, else the main shop.
  const about = single ?? shops.find((m) => m.workspace.id === inAddress) ?? main;

  /** Ticks a shop, or unticks it (one always stays); a page of an unticked shop opens for one that's ticked. */
  const toggle = (id: string) => {
    const next = ticked.includes(id) ? ticked.filter((each) => each !== id) : [...ticked, id];
    if (next.length === 0) return;
    setShopScope(next.length === shops.length ? 'all' : next);
    if (inAddress && !next.includes(inAddress) && !pathname.endsWith('/amanat')) router.push(pathname.replace(/^\/w\/[^/]+/, `/w/${next[0]}`));
  };

  return { shops, ticked, everything, single, about, main, toggle, pickAll: () => setShopScope('all') };
}

/** "1 member · 2 invited", for the shop in view. */
function MembersLine({ shopId }: { shopId: string }) {
  const t = useTranslations('switcher');
  const team = useTeam(shopId).data;
  const count = Math.max(1, team?.members.length ?? 1);
  const invited = team?.invitations.length ?? 0;
  return (
    <span className="text-muted-foreground ms-auto shrink-0 text-xs">
      {t('members', { count })}
      {invited > 0 ? ` · ${t('invited', { count: invited })}` : null}
    </span>
  );
}

export function ShopsMenuItems({ onInvite, onNewShop }: { onInvite: () => void; onNewShop: () => void }) {
  const t = useTranslations('switcher');
  const { shops, ticked, everything, about, toggle, pickAll } = useShopTicks();
  if (!about) return null;

  return (
    <>
      <DropdownMenuItem className={ITEM} onClick={onInvite}>
        <MailIcon />
        {t('invite')}
        <MembersLine shopId={about.workspace.id} />
      </DropdownMenuItem>

      <p className="text-muted-foreground px-2 pt-2.5 pb-1 text-xs font-medium">{t('yourShops')}</p>
      <DropdownMenuItem className={ITEM} closeOnClick={false} onClick={pickAll} role="menuitemcheckbox" aria-checked={everything}>
        <span className="bg-foreground/10 flex size-5 shrink-0 items-center justify-center rounded-[5px]">
          <LayoutGridIcon className="size-3!" />
        </span>
        <span className="min-w-0 flex-1 truncate">{t('allShops')}</span>
        {everything ? <CheckIcon /> : null}
      </DropdownMenuItem>
      {shops.map(({ workspace }) => (
        <DropdownMenuItem key={workspace.id} className={ITEM} closeOnClick={false} onClick={() => toggle(workspace.id)} role="menuitemcheckbox" aria-checked={ticked.includes(workspace.id)}>
          <ShopBadge id={workspace.id} name={workspace.name} className="size-5 shrink-0 rounded-[5px] text-[10px]" />
          <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
          {workspace.isMain ? <span className="shrink-0 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-500">{t('main')}</span> : null}
          {ticked.includes(workspace.id) ? <CheckIcon /> : <span className="size-4 shrink-0" />}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem className={cn(ITEM, 'text-[#2f80ed] [&_svg]:text-[#2f80ed]')} onClick={onNewShop}>
        <PlusIcon />
        {t('newShop')}
      </DropdownMenuItem>
    </>
  );
}
