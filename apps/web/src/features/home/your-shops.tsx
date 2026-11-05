'use client';

import type { Workspace, WorkspaceMembership } from '@sarrif/core';
import { EllipsisIcon, EyeIcon, EyeOffIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { MoneyText } from '@/components/money-text';
import { colourFor } from '@/components/shop-badge';
import { Button } from '@/components/ui/button';
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountLabel } from '@/features/accounts/account-label';
import { useRemoveShop, useSetMainShop } from '@/features/workspaces/queries';
import { Link } from '@/i18n/navigation';
import { directionOf } from '@/i18n/routing';
import { errorKey, useMessage } from '@/lib/api/errors';
import { promiseToast } from '@/lib/promise-toast';
import { cn } from '@/lib/utils';

import { NewShopDialog } from './new-shop-dialog';
import { useDaySummary } from './queries';

/** Where the eye's choice is kept on this device: customers stand at the counter. */
const HIDE_KEY = 'amanat.hide.shops';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHidden(hidden: boolean) {
  try {
    localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
  } catch {
    // Storage blocked: it still hides, just not after a reload.
  }
}

/**
 * Your shops as cards, like M-Pesa's balance cards: swipe from one to the
 * next (the main shop first), one dot per card underneath, and a last card
 * to add a shop. Each card: ★ on the main shop, its name, the eye, each
 * account with its balance (two to a row), and Open shop. The eye hides every shop's money and stays that
 * way, even after closing the app, until it's tapped again.
 *
 * `onShown` says which shop is on screen: Home's quick actions record into it.
 */
export function YourShops({ shops, main, onShown }: { shops: WorkspaceMembership[]; main: Workspace; onShown: (shopId: string) => void }) {
  const t = useTranslations('home');
  const dir = directionOf(useLocale());
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [hidden, setHidden] = useState(readHidden);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<{ kind: 'main' | 'delete'; shop: Workspace } | null>(null);
  const cards = shops.length + 1;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const index = api.selectedScrollSnap();
      setSelected(index);
      const shop = shops[index];
      if (shop) onShown(shop.workspace.id);
    };
    onSelect();
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api, shops, onShown]);

  const toggleHidden = () => {
    writeHidden(!hidden);
    setHidden(!hidden);
  };

  return (
    <section aria-label={t('yourShops')} className="flex flex-col gap-4">
      <Carousel setApi={setApi} opts={{ align: 'start', direction: dir }}>
        <CarouselContent className="-ms-3">
          {shops.map(({ workspace }) => (
            <CarouselItem key={workspace.id} className="basis-[88%] ps-3 sm:basis-[60%] lg:basis-[46%]">
              <ShopCard
                shop={workspace}
                hidden={hidden}
                onToggleHidden={toggleHidden}
                onSetMain={() => setAsking({ kind: 'main', shop: workspace })}
                onDelete={() => setAsking({ kind: 'delete', shop: workspace })}
              />
            </CarouselItem>
          ))}
          <CarouselItem className="basis-[88%] ps-3 sm:basis-[60%] lg:basis-[46%]">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-foreground/3 flex h-full min-h-52 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors"
            >
              <span className="bg-foreground/5 flex size-12 items-center justify-center rounded-full">
                <PlusIcon className="size-6" />
              </span>
              <span className="text-sm font-semibold">{t('newShop.button')}</span>
            </button>
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className="flex justify-center gap-1.5">
        {Array.from({ length: cards }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={index < shops.length ? shops[index]!.workspace.name : t('newShop.button')}
            aria-current={index === selected ? 'true' : undefined}
            onClick={() => api?.scrollTo(index)}
            className={cn('h-1.5 rounded-full transition-all', index === selected ? 'bg-primary w-6' : 'bg-foreground/20 w-1.5')}
          />
        ))}
      </div>

      <NewShopDialog open={adding} onOpenChange={setAdding} main={main} />
      <ConfirmShopChange asking={asking} main={main} onClose={() => setAsking(null)} />
    </section>
  );
}

function ShopCard({
  shop,
  hidden,
  onToggleHidden,
  onSetMain,
  onDelete,
}: {
  shop: Workspace;
  hidden: boolean;
  onToggleHidden: () => void;
  onSetMain: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('home');
  return (
    <div className="bg-card relative flex h-full min-h-52 flex-col gap-4 overflow-hidden rounded-xl p-5 ps-6">
      {/* The shop's colour down the leading edge, like M-Pesa's green. */}
      <span aria-hidden className={cn('absolute inset-y-3 start-0 w-1 rounded-e-full', colourFor(shop.id))} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          {shop.isMain ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
              <StarIcon className="size-3.5 fill-current" />
              {t('main')}
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold">{shop.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? t('showShops') : t('hideShops')}
            aria-pressed={hidden}
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex size-8 items-center justify-center rounded-lg transition-colors [&_svg]:size-5"
          >
            {hidden ? <EyeIcon /> : <EyeOffIcon />}
          </button>
          <ShopCardMenu shop={shop} onSetMain={onSetMain} onDelete={onDelete} />
        </div>
      </div>

      <ShopTotals shopId={shop.id} hidden={hidden} />

      <Link
        href={`/w/${shop.id}`}
        className="border-primary/50 hover:bg-primary/10 mt-auto flex h-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors"
      >
        {t('openShop')}
      </Link>
    </div>
  );
}

/** Each of the shop's accounts with its balance, two to a row: $ Cash and $ Sallam, then KSh Cash and M-Pesa. */
function ShopTotals({ shopId, hidden }: { shopId: string; hidden: boolean }) {
  const summary = useDaySummary(shopId).data;
  const label = useAccountLabel();
  if (!summary) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }
  // Dollars first, then by currency; cash before the other place within one ($ Cash, $ Sallam, KSh Cash, M-Pesa).
  const accounts = [...summary.accounts].sort(
    (a, b) =>
      Number(b.account.currency === 'USD') - Number(a.account.currency === 'USD') ||
      a.account.currency.localeCompare(b.account.currency) ||
      Number(a.account.type !== 'cash') - Number(b.account.type !== 'cash'),
  );
  return (
    <div aria-hidden={hidden} className={cn('grid grid-cols-2 gap-x-4 gap-y-3 transition-[filter]', hidden && 'pointer-events-none blur-md select-none')}>
      {accounts.map(({ account, balance }) => (
        <div key={account.id} className="flex min-w-0 flex-col">
          <span className="text-muted-foreground truncate text-xs">{label(account)}</span>
          <MoneyText money={{ amount: balance, currency: account.currency }} className="truncate text-lg font-semibold" />
        </div>
      ))}
    </div>
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
        className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex size-8 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
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
              <DialogDescription>{asking.kind === 'main' ? t('setMainBody', { old: main.name }) : t('deleteBody')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} className="h-11 rounded-xl">
                {t('newShop.cancel')}
              </Button>
              <Button type="button" variant={asking.kind === 'delete' ? 'destructive' : 'default'} onClick={confirm} className="h-11 rounded-xl font-semibold">
                {asking.kind === 'main' ? t('setMain') : t('deleteShop')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
