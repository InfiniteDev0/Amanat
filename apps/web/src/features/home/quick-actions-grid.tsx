'use client';

import type { WorkspaceMembership } from '@sarrif/core';
import { ChartNoAxesColumnIcon, ChevronRightIcon, LockIcon, SettingsIcon, TrendingUpIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Link } from '@/i18n/navigation';

import { ACTION_ICONS, ActionHost, type ShopAction, SHOP_ACTIONS } from './shop-actions';

const TILE = 'group flex flex-col items-center gap-2 rounded-xl p-2 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40';
const ICON =
  'bg-foreground/5 text-primary group-hover:bg-foreground/10 flex size-12 items-center justify-center rounded-full transition-colors group-disabled:group-hover:bg-foreground/5 [&_svg]:size-5';

/** One action: an icon in a circle, its name under it. A button (opens a form) or a link (a page of the shop). */
function Tile({ icon, label, onClick, href, disabled }: { icon: ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const content = (
    <>
      <span className={ICON}>{icon}</span>
      <span className="text-xs font-medium sm:text-sm">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={TILE}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? label : undefined} className={TILE}>
      {content}
    </button>
  );
}

/**
 * Home's Quick actions, like M-Pesa's: four to a row, Exchange, Sallam, Move,
 * Amanat, then Expense, Close day, Reports, Team; "View all" opens every one.
 * They act on the shop on screen (`shopId`: the card showing above), and the
 * form says which shop at the top.
 */
export function QuickActionsGrid({ shops, shopId }: { shops: WorkspaceMembership[]; shopId: string }) {
  const t = useTranslations('home');
  const [action, setAction] = useState<ShopAction | null>(null);
  const [all, setAll] = useState(false);

  const open = (next: ShopAction) => {
    setAll(false);
    setAction(next);
  };

  const formTiles = SHOP_ACTIONS.map((id) => <Tile key={id} icon={ACTION_ICONS[id]} label={t(`quick.${id}`)} onClick={() => open(id)} />);
  const closeDay = <Tile key="close" icon={<LockIcon />} label={t('closeDay')} disabled />;
  const reports = <Tile key="reports" icon={<ChartNoAxesColumnIcon />} label={t('actions.reports')} href={`/w/${shopId}/reports`} />;
  const team = <Tile key="team" icon={<UsersIcon />} label={t('actions.team')} href={`/w/${shopId}/team`} />;

  return (
    <section aria-labelledby="quick-actions" className="bg-card rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="quick-actions" className="text-base font-semibold">
          {t('quick.title')}
        </h2>
        <button type="button" onClick={() => setAll(true)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors">
          {t('actions.viewAll')}
          <ChevronRightIcon className="size-4 rtl:rotate-180" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-y-4">
        {formTiles.slice(0, 4)}
        {formTiles[4]}
        {closeDay}
        {reports}
        {team}
      </div>

      <Dialog open={all} onOpenChange={setAll}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('actions.all')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-4 gap-y-4">
            {formTiles}
            {closeDay}
            {reports}
            {team}
            <Tile icon={<TrendingUpIcon />} label={t('actions.profit')} href={`/w/${shopId}/profit`} />
            <Tile icon={<WalletIcon />} label={t('actions.amanatList')} href={`/w/${shopId}/amanat`} />
            <Tile icon={<SettingsIcon />} label={t('actions.settings')} href={`/w/${shopId}/settings`} />
          </div>
        </DialogContent>
      </Dialog>

      <ActionHost shops={shops} action={action} shopId={shopId} onClose={() => setAction(null)} />
    </section>
  );
}
