'use client';

import { businessDate, type CurrencyCode, ratedCurrencies } from '@sarrif/core';
import { useState } from 'react';

import { AccountDialog } from '@/features/accounts/account-dialog';
import { HoldSheet } from '@/features/amanat/amanat-sheets';
import { DealSheet, MoveSheet } from '@/features/profit/forms';
import { useDeals } from '@/features/deals/queries';
import { ExpenseDialog } from '@/features/expenses/expense-dialog';
import { RatesDialog } from '@/features/rates/rates-dialog';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';

import { AccountCards } from './account-cards';
import { HomeHeader } from './home-header';
import { useOpenFromAddress } from './open-from-address';
import { useDaySummary } from './queries';
import { QuickActions } from './quick-actions';
import { RateCards, RatesBanner } from './rates-section';

/**
 * Home, top to bottom: a one-line banner across the panel while today's
 * rates aren't set; the greeting and the totals; the day's rates; the
 * accounts; then quick actions. The day
 * starts at today. The rest of Home comes later.
 */
export function HomeScreen() {
  const { workspace } = useWorkspace();
  const { day, today, isToday } = useShopDay();
  const picked = isToday ? null : day;
  // The rates dialog: which currencies it's open for.
  const [editing, setEditing] = useState<CurrencyCode[] | null>(null);
  useOpenFromAddress('set-rates', () => setEditing(ratedCurrencies(workspace)));
  // An account's dialog: which account it's open for.
  const [accountId, setAccountId] = useState<string | null>(null);
  // Opened from Move money: the dialog starts on its Move tab.
  const [moving, setMoving] = useState(false);
  // Today's figures: the dialogs act on today, whatever day is shown.
  const todays = useDaySummary(workspace.id).data;
  const board = todays?.board;
  // Sallam, Exchange, Move and Expense open as sheets over Home.
  const [dealSheet, setDealSheet] = useState<'sallam' | 'exchange' | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const deals = useDeals(workspace.id).data ?? [];

  return (
    <>
      <RatesBanner isToday={isToday} onSet={setEditing} />
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <HomeHeader date={picked ?? undefined} />
        {/* <RateCards date={picked ?? undefined} isToday={isToday} onEdit={setEditing} /> */}
        <AccountCards
          date={picked ?? undefined}
          onOpen={(id) => {
            setMoving(false);
            setAccountId(id);
          }}
        />
        <QuickActions
          onSallam={() => setDealSheet('sallam')}
          onExchange={() => setDealSheet('exchange')}
          onExpense={() => setExpenseOpen(true)}
          onMove={() => setMoveOpen(true)}
          onAmanat={() => setHoldOpen(true)}
        />
      </div>
      {todays ? (
        <>
          <DealSheet
            type={dealSheet ?? 'sallam'}
            open={dealSheet !== null}
            onOpenChange={(open) => (open ? undefined : setDealSheet(null))}
            accounts={todays.accounts.map((p) => p.account)}
            board={todays.board}
            rows={deals}
          />
          <MoveSheet open={moveOpen} onOpenChange={setMoveOpen} accounts={todays.accounts.map((p) => p.account)} board={todays.board} />
          <HoldSheet open={holdOpen} onOpenChange={setHoldOpen} accounts={todays.accounts.map((p) => p.account)} />
        </>
      ) : null}
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} accounts={todays?.accounts.map((p) => p.account) ?? []} />
      {todays ? (
        <AccountDialog
          position={todays.accounts.find((p) => p.account.id === accountId) ?? null}
          positions={todays.accounts}
          board={todays.board}
          initialTab={moving ? 'move' : undefined}
          onClose={() => setAccountId(null)}
        />
      ) : null}
      {board ? (
        <RatesDialog
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          workspaceId={workspace.id}
          date={today}
          currencies={editing ?? []}
          board={board}
        />
      ) : null}
    </>
  );
}
