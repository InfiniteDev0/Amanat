'use client';

import { businessDate, type CurrencyCode } from '@sarrif/core';
import { useState } from 'react';

import { AccountDialog } from '@/features/accounts/account-dialog';
import { RatesDialog } from '@/features/rates/rates-dialog';
import { useWorkspace } from '@/features/workspaces/workspace-context';

import { AccountCards } from './account-cards';
import { HomeToolbar } from './home-toolbar';
import { useDaySummary } from './queries';
import { RateCards, RatesBanner } from './rates-section';

/**
 * Home, top to bottom: a one-line banner across the panel while today's
 * rates aren't set; the day and the currency to show the total in; the
 * day's rates; then the accounts. Day and currency start at today and the
 * shop's base. The rest of Home comes later.
 */
export function HomeScreen() {
  const { workspace } = useWorkspace();
  const today = businessDate(workspace.timeZone);
  const [picked, setPicked] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(workspace.baseCurrency);
  // The rates dialog: which currencies it's open for.
  const [editing, setEditing] = useState<CurrencyCode[] | null>(null);
  // An account's dialog: which account it's open for.
  const [accountId, setAccountId] = useState<string | null>(null);
  // Today's figures: the dialogs act on today, whatever day is shown.
  const todays = useDaySummary(workspace.id).data;
  const board = todays?.board;
  const day = picked ?? today;
  const isToday = picked === null;
  // The base first, then the others as the shop lists them.
  const currencies = [workspace.baseCurrency, ...workspace.currencies.filter((code) => code !== workspace.baseCurrency)];
  // Back to the base if the shop stops trading the chosen one.
  const shownIn = currencies.includes(currency) ? currency : workspace.baseCurrency;

  return (
    <>
      <RatesBanner isToday={isToday} onSet={setEditing} />
      <div className="flex flex-col gap-4 p-4 lg:p-6">
        <HomeToolbar
          day={day}
          today={today}
          onDayChange={(next) => setPicked(next === today ? null : next)}
          currency={shownIn}
          currencies={currencies}
          onCurrencyChange={setCurrency}
        />
        <RateCards date={picked ?? undefined} isToday={isToday} onEdit={setEditing} />
        <AccountCards date={picked ?? undefined} currency={shownIn} onOpen={setAccountId} />
      </div>
      {todays ? (
        <AccountDialog
          position={todays.accounts.find((p) => p.account.id === accountId) ?? null}
          positions={todays.accounts}
          board={todays.board}
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
