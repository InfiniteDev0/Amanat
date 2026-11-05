'use client';

import type { WorkspaceMembership } from '@sarrif/core';
import { ArrowDownUpIcon, ArrowLeftRightIcon, HandCoinsIcon, LockIcon, ReceiptIcon, SmartphoneIcon, StarIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';

import { ActionSheetTop } from '@/components/action-sheet';
import { ShopBadge } from '@/components/shop-badge';
import { HoldSheet } from '@/features/amanat/amanat-sheets';
import { useDeals } from '@/features/deals/queries';
import { ExpenseDialog } from '@/features/expenses/expense-dialog';
import { DealSheet, MoveSheet } from '@/features/profit/forms';
import { WorkspaceProvider } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { useDaySummary } from './queries';

type Action = 'exchange' | 'sallam' | 'move' | 'amanat' | 'expense';

const ACTIONS: { id: Action; icon: ReactNode }[] = [
  { id: 'exchange', icon: <ArrowLeftRightIcon /> },
  { id: 'sallam', icon: <SmartphoneIcon /> },
  { id: 'move', icon: <ArrowDownUpIcon /> },
  { id: 'amanat', icon: <HandCoinsIcon /> },
  { id: 'expense', icon: <ReceiptIcon /> },
];

const BUTTON =
  'bg-card hover:bg-card/70 focus-visible:ring-ring/50 flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 disabled:opacity-50 disabled:hover:bg-card [&_svg]:size-4';

/**
 * The everyday jobs, one tap away: Exchange, Sallam, Move, Amanat, Expense.
 * Each opens its form for a shop: `defaultShopId` (the main shop on Home,
 * this shop on its page), with a picker on top of the form in case it's
 * meant for another. Until the ledger is in the database, a real shop's
 * Save is off ("Coming in the next update"). On a shop's page, Close day sits
 * at the end (off until it's built for real shops).
 */
export function ShopActions({ shops, defaultShopId, closeDay = false }: { shops: WorkspaceMembership[]; defaultShopId: string; closeDay?: boolean }) {
  const t = useTranslations('home');
  const [action, setAction] = useState<Action | null>(null);
  const [shopId, setShopId] = useState(defaultShopId);
  const membership = shops.find((m) => m.workspace.id === shopId) ?? shops.find((m) => m.workspace.id === defaultShopId);

  const open = (next: Action) => {
    setShopId(defaultShopId);
    setAction(next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {ACTIONS.map(({ id, icon }) => (
          <button key={id} type="button" onClick={() => open(id)} className={BUTTON}>
            {icon}
            {t(`quick.${id}`)}
          </button>
        ))}
        {closeDay ? (
          <button type="button" disabled title={t('closeDaySoon')} className={cn(BUTTON, 'sm:ms-auto')}>
            <LockIcon />
            {t('closeDay')}
          </button>
        ) : null}
      </div>

      {action && membership ? (
        <ActionFor
          key={membership.workspace.id}
          membership={membership}
          action={action}
          onClose={() => setAction(null)}
          picker={shops.length > 1 ? <ShopPicker shops={shops} value={membership.workspace.id} onChange={setShopId} /> : null}
        />
      ) : null}
    </>
  );
}

/** The form for one shop, with that shop's accounts and today's rates. */
function ActionFor({
  membership,
  action,
  onClose,
  picker,
}: {
  membership: WorkspaceMembership;
  action: Action;
  onClose: () => void;
  picker: ReactNode;
}) {
  const id = membership.workspace.id;
  const summary = useDaySummary(id).data;
  const deals = useDeals(id).data ?? [];
  if (!summary) return null;
  const accounts = summary.accounts.map((position) => position.account);
  const onOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <WorkspaceProvider workspace={membership.workspace} role={membership.role}>
      <ActionSheetTop value={picker}>
        {action === 'exchange' || action === 'sallam' ? (
          <DealSheet type={action} open onOpenChange={onOpenChange} accounts={accounts} board={summary.board} rows={deals} />
        ) : action === 'move' ? (
          <MoveSheet open onOpenChange={onOpenChange} accounts={accounts} board={summary.board} />
        ) : action === 'amanat' ? (
          <HoldSheet open onOpenChange={onOpenChange} accounts={accounts} />
        ) : (
          <ExpenseDialog open onOpenChange={onOpenChange} accounts={accounts} />
        )}
      </ActionSheetTop>
    </WorkspaceProvider>
  );
}

/** Which shop the form records into: the main one first, ★ on it. */
function ShopPicker({ shops, value, onChange }: { shops: WorkspaceMembership[]; value: string; onChange: (id: string) => void }) {
  const t = useTranslations('home');
  return (
    <div className="mb-5 flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{t('forShop')}</span>
      <div role="radiogroup" aria-label={t('forShop')} className="flex flex-wrap gap-2">
        {shops.map(({ workspace }) => {
          const selected = workspace.id === value;
          return (
            <button
              key={workspace.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(workspace.id)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                selected ? 'bg-primary text-primary-foreground' : 'bg-field hover:bg-field-focus',
              )}
            >
              <ShopBadge id={workspace.id} name={workspace.name} className="size-5 text-[10px]" />
              {workspace.name}
              {workspace.isMain ? <StarIcon aria-label={t('main')} className="size-3.5 fill-current" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
