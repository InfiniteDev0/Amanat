'use client';

import { addTo, type CurrencyCode, type Money, totalsToList, type Workspace, type WorkspaceMembership } from '@sarrif/core';
import { EllipsisIcon, PlusIcon, StarIcon, StoreIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { MoneyText } from '@/components/money-text';
import { colourFor, ShopBadge } from '@/components/shop-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useRemoveShop, useSetMainShop } from '@/features/workspaces/queries';
import { Link } from '@/i18n/navigation';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';
import { cn } from '@/lib/utils';

import { NewShopDialog } from './new-shop-dialog';
import { useDaySummary } from './queries';

const MAX_PER_ROW = 4;

/**
 * Your shops, one card each: a band in the shop's colour, ★ Main on the main
 * shop, its name, and what's in it per currency (its accounts' balances; with
 * nothing recorded yet, the opening amounts). A card opens the shop's page.
 * Its ⋯ menu: Set as main, and Delete for any shop but the main one. "+ New
 * shop" adds another.
 */
export function YourShops({ shops, main }: { shops: WorkspaceMembership[]; main: Workspace }) {
  const t = useTranslations('home');
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<{ kind: 'main' | 'delete'; shop: Workspace } | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
          <StoreIcon className="size-4" />
          {t('yourShops')}
        </h2>
        {/* White on black in dark mode, black on white in light. */}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="bg-foreground text-background flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
        >
          <PlusIcon className="size-4" />
          {t('newShop.button')}
        </button>
      </div>

      <ul className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(shops.length, 2), MAX_PER_ROW)}, minmax(0, 1fr))` }}>
        {shops.map(({ workspace }) => (
          <li key={workspace.id} className="relative min-w-0">
            <ShopCard shop={workspace} />
            <ShopCardMenu
              shop={workspace}
              onSetMain={() => setAsking({ kind: 'main', shop: workspace })}
              onDelete={() => setAsking({ kind: 'delete', shop: workspace })}
            />
          </li>
        ))}
      </ul>

      <NewShopDialog open={adding} onOpenChange={setAdding} main={main} />
      <ConfirmShopChange asking={asking} main={main} onClose={() => setAsking(null)} />
    </section>
  );
}

function ShopCard({ shop }: { shop: Workspace }) {
  const t = useTranslations('home');
  return (
    <Link
      href={`/w/${shop.id}`}
      className="bg-foreground/5 hover:bg-foreground/8 flex h-44 w-full flex-col overflow-hidden rounded-2xl transition-colors"
    >
      <span className={cn('h-12 shrink-0 opacity-30', colourFor(shop.id))} />
      <ShopBadge id={shop.id} name={shop.name} className="ms-4 -mt-4 size-8 rounded-lg text-sm" />
      <span className="flex flex-col gap-1 px-4 pt-3">
        {shop.isMain ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
            <StarIcon className="size-3.5 fill-current" />
            {t('main')}
          </span>
        ) : null}
        <span className="truncate text-[15px] leading-snug font-medium">{shop.name}</span>
        <ShopTotals shopId={shop.id} />
      </span>
    </Link>
  );
}

/** "$ 50,000 · KSh 400,000": what the shop's accounts hold, per currency. */
function ShopTotals({ shopId }: { shopId: string }) {
  const summary = useDaySummary(shopId).data;
  if (!summary) return <Skeleton className="h-4 w-32" />;
  const totals = new Map<CurrencyCode, number>();
  for (const { account, balance } of summary.accounts) addTo(totals, { amount: balance, currency: account.currency });
  // Dollars first, like the market says it: "$ 50,000 · KSh 400,000".
  const list: Money[] = totalsToList(totals).sort((a, b) => Number(b.currency === 'USD') - Number(a.currency === 'USD'));
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-sm">
      {list.map((money, index) => (
        <span key={money.currency} className="flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <MoneyText money={money} />
        </span>
      ))}
    </span>
  );
}

function ShopCardMenu({ shop, onSetMain, onDelete }: { shop: Workspace; onSetMain: () => void; onDelete: () => void }) {
  const t = useTranslations('home');
  // The main shop has nothing to offer: it's already main, and it can't be deleted.
  if (shop.isMain) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('shopMenu', { shop: shop.name })}
        className="bg-background/60 hover:bg-background absolute end-3 top-3 flex size-8 items-center justify-center rounded-lg backdrop-blur-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <EllipsisIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border dark:bg-black">
        <DropdownMenuItem className="h-9 gap-2.5" onClick={onSetMain}>
          <StarIcon />
          {t('setMain')}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive h-9 gap-2.5 [&_svg]:text-destructive" onClick={onDelete}>
          <Trash2Icon />
          {t('deleteShop')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Make Garissa your main shop?" or "Delete Garissa?", then the change. */
function ConfirmShopChange({ asking, main, onClose }: { asking: { kind: 'main' | 'delete'; shop: Workspace } | null; main: Workspace; onClose: () => void }) {
  const t = useTranslations('home');
  const message = useMessage();
  const setMain = useSetMainShop();
  const remove = useRemoveShop();
  const shop = asking?.shop;

  const confirm = () => {
    if (!asking || !shop) return;
    onClose();
    const work = asking.kind === 'main' ? setMain.mutateAsync(shop.id) : remove.mutateAsync(shop.id);
    promiseToast(work, {
      loading: t('saving'),
      success: () => (asking.kind === 'main' ? t('mainSaved', { shop: shop.name }) : t('deleted', { shop: shop.name })),
      error: (error) => message(errorKey(error)),
    }).catch(() => undefined);
  };

  return (
    <Dialog open={asking !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-sm">
        {shop && asking ? (
          <>
            <DialogHeader>
              <DialogTitle>{asking.kind === 'main' ? t('setMainTitle', { shop: shop.name }) : t('deleteTitle', { shop: shop.name })}</DialogTitle>
              <DialogDescription>
                {asking.kind === 'main' ? t('setMainBody', { old: main.name }) : t('deleteBody')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} className="h-11 rounded-xl">
                {t('newShop.cancel')}
              </Button>
              <Button
                type="button"
                variant={asking.kind === 'delete' ? 'destructive' : 'default'}
                onClick={confirm}
                className="h-11 rounded-xl font-semibold"
              >
                {asking.kind === 'main' ? t('setMain') : t('deleteShop')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
