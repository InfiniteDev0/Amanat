'use client';

import type { WorkspaceMembership } from '@sarrif/core';
import { gooeyToast } from 'goey-toast';
import { ChartNoAxesColumnIcon, ChevronDownIcon, LockIcon, SettingsIcon, TrendingUpIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';

import { AdminButton, Modal } from '@/components/barista-modal';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { PeopleDialog } from '@/features/team/people-dialog';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';

// The action sheets are off: recording comes back with the new money engine (Phase 3).
// import { ACTION_ICONS, ActionHost, type ShopAction, SHOP_ACTIONS } from './shop-actions';
import { ACTION_ICONS, SHOP_ACTIONS } from './shop-actions';

/** People for the shop on screen (its own context: the dialog reads the shop and your right there). */
function PeopleFor({ shops, shopId, open, onOpenChange }: { shops: WorkspaceMembership[]; shopId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const membership = shops.find((m) => m.workspace.id === shopId);
  if (!membership) return null;
  return (
    <WorkspaceProvider workspace={membership.workspace} role={membership.role}>
      <PeopleDialog open={open} onOpenChange={onOpenChange} />
    </WorkspaceProvider>
  );
}

/** Each action's colour, like M-Pesa's: the icon on a soft tint of it. */
const TINT: Record<string, string> = {
  exchange: 'bg-emerald-500/12 text-emerald-500',
  sallam: 'bg-sky-500/12 text-sky-500',
  move: 'bg-violet-500/12 text-violet-500',
  amanat: 'bg-amber-500/12 text-amber-500',
  expense: 'bg-rose-500/12 text-rose-500',
  close: 'bg-foreground/8 text-muted-foreground',
  reports: 'bg-blue-500/12 text-blue-500',
  team: 'bg-teal-500/12 text-teal-500',
  profit: 'bg-lime-500/12 text-lime-500',
  amanatList: 'bg-orange-500/12 text-orange-500',
  settings: 'bg-foreground/8 text-foreground',
};

/** Barista's easing: quick to start, soft to land. */
const EASE = [0.22, 1, 0.36, 1] as const;

interface TileProps {
  id: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  compact: boolean;
}

/**
 * One action. Roomy: a tile with the icon on its colour, the name and a line
 * under it. Compact (beside the shop page's drawers): the icon and the name.
 * A button opens a form; a link goes to a page of the shop.
 */
function Tile({ id, icon, label, hint, onClick, href, disabled, compact }: TileProps) {
  const className = cn(
    'group outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-45 transition-colors',
    compact
      ? 'flex flex-col items-center gap-2 rounded-lg p-2 text-center hover:bg-foreground/4'
      : 'bg-foreground/4 hover:bg-foreground/7 disabled:hover:bg-foreground/4 flex items-center gap-3 rounded-lg p-3 text-start',
  );
  const content = (
    <>
      <span className={cn('flex shrink-0 items-center justify-center rounded-lg [&_svg]:size-5', compact ? 'size-11' : 'size-10', TINT[id])}>{icon}</span>
      {compact ? (
        <span className="text-xs font-medium">{label}</span>
      ) : (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{label}</span>
          {hint ? <span className="text-muted-foreground truncate text-xs">{hint}</span> : null}
        </span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

/**
 * Quick actions, like M-Pesa's: Exchange, Sallam, Move, Amanat, then
 * Expense, Close day, Reports, Team. "View all" opens the rest in place, as
 * Barista's accordions do (the height eases open, the tiles slide up into
 * it). They act on the shop on screen (`shopId`: the card showing above, or
 * the shop page's shop), and the form names that shop at the top. `compact`
 * for a narrow column (the shop page): icons and names only.
 */
export function QuickActionsGrid({ shops, shopId, compact = false, className }: { shops: WorkspaceMembership[]; shopId: string; compact?: boolean; className?: string }) {
  const t = useTranslations('home');
  // const [action, setAction] = useState<ShopAction | null>(null);
  const [all, setAll] = useState(false);
  // People opens as a dialog over the page, not a page of its own.
  const [people, setPeople] = useState(false);
  // Exchange: an empty dialog for now, its form to come.
  const [exchange, setExchange] = useState(false);
  const panelId = useId();
  const reduce = useReducedMotion();
  const duration = reduce ? 0 : 0.35;

  const tile = (props: Omit<TileProps, 'compact'>) => <Tile key={props.id} {...props} compact={compact} />;
  const grid = cn('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4');

  return (
    <section aria-labelledby="quick-actions" className={cn(className)}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id="quick-actions" className="text-base font-semibold">
          {t('quick.title')}
        </h2>
        <button
          type="button"
          onClick={() => setAll(!all)}
          aria-expanded={all}
          aria-controls={panelId}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium transition-colors"
        >
          {all ? t('actions.less') : t('actions.viewAll')}
          <ChevronDownIcon className={cn('size-4 transition-transform duration-300', all && 'rotate-180')} />
        </button>
      </div>

      <div className={grid}>
        {SHOP_ACTIONS.map((id) =>
          tile({ id, icon: ACTION_ICONS[id], label: t(`quick.${id}`), hint: t(`quick.${id}Hint`), onClick: () => (id === 'exchange' ? setExchange(true) : gooeyToast.info(t('actions.soon'))) }),
        )}
        {tile({ id: 'close', icon: <LockIcon />, label: t('closeDay'), hint: t('closeDaySoon'), disabled: true })}
        {tile({ id: 'reports', icon: <ChartNoAxesColumnIcon />, label: t('actions.reports'), hint: t('actions.reportsHint'), href: `/w/${shopId}/reports` })}
        {tile({ id: 'team', icon: <UsersIcon />, label: t('actions.team'), hint: t('actions.teamHint'), onClick: () => setPeople(true) })}
      </div>

      {/* The rest, opened in place. Closed, it's out of the page (and of Tab). */}
      <AnimatePresence initial={false}>
        {all ? (
          <motion.div
            id={panelId}
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration, ease: EASE }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: reduce ? 0 : 12 }}
              animate={{ y: 0 }}
              exit={{ y: reduce ? 0 : 12 }}
              transition={{ duration, ease: EASE }}
              className={cn(grid, 'pt-2')}
            >
              {tile({ id: 'profit', icon: <TrendingUpIcon />, label: t('actions.profit'), hint: t('actions.profitHint'), href: `/w/${shopId}/profit` })}
              {tile({ id: 'amanatList', icon: <WalletIcon />, label: t('actions.amanatList'), hint: t('actions.amanatListHint'), href: `/w/${shopId}/amanat` })}
              {tile({ id: 'settings', icon: <SettingsIcon />, label: t('actions.settings'), hint: t('actions.settingsHint'), href: `/w/${shopId}/settings` })}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* <ActionHost shops={shops} action={action} shopId={shopId} onClose={() => setAction(null)} /> */}
      <PeopleFor shops={shops} shopId={shopId} open={people} onOpenChange={setPeople} />
      <Modal
        open={exchange}
        onClose={() => setExchange(false)}
        title={t('quick.exchange')}
        description={t('quick.exchangeHint')}
        footer={
          <AdminButton variant="ghost" onClick={() => setExchange(false)}>
            {t('actions.cancel')}
          </AdminButton>
        }
      >
        {null}
      </Modal>
    </section>
  );
}
