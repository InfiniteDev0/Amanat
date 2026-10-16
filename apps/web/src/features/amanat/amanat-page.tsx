'use client';

import type { AmanatRow, Money } from '@sarrif/core';
import { AnimatePresence, motion } from 'motion/react';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useDaySummary } from '@/features/home/queries';
import { useAccountShort, useShortMoney } from '@/features/profit/money-text';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { AmanatSheet, HoldSheet } from './amanat-sheets';
import { useAmanat } from './queries';

/** Per-currency totals of what's still held (USD first). */
function heldTotals(rows: AmanatRow[]): Money[] {
  const totals = new Map<string, number>();
  for (const { amanat, returned } of rows) if (!returned) totals.set(amanat.currency, (totals.get(amanat.currency) ?? 0) + amanat.amount);
  return [...totals].map(([currency, amount]) => ({ amount, currency }) as Money).sort((a) => (a.currency === 'USD' ? -1 : 1));
}

/** One amanat as a line: "Ali · 500 $ in $ Cash", Held or Returned at the end. */
function Row({ row, onOpen }: { row: AmanatRow; onOpen: (row: AmanatRow) => void }) {
  const t = useTranslations('amanat');
  const money = useShortMoney();
  const short = useAccountShort();
  const { workspace } = useWorkspace();
  const accounts = useDaySummary(workspace.id).data?.accounts.map((p) => p.account) ?? [];
  const account = accounts.find((a) => a.id === row.account.id);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
      className="bg-card mb-2 overflow-hidden rounded-xl last:mb-0"
    >
      <button type="button" onClick={() => onOpen(row)} className={cn('hover:bg-foreground/5 flex w-full items-center gap-4 px-4 py-3.5 text-start text-base transition-colors', row.returned && 'opacity-60')}>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{row.clientName}</span>
          <span className="text-muted-foreground block text-sm">
            {t('inAccount', { amount: money({ amount: row.amanat.amount, currency: row.amanat.currency }), account: account ? short(account) : row.account.name })}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-sm font-semibold',
            row.returned ? 'bg-foreground/5 text-muted-foreground' : 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
          )}
        >
          {row.returned ? t('returned') : t('heldTag')}
        </span>
      </button>
    </motion.li>
  );
}

/**
 * The Amanat page (Build Plan v4, 7.4): what's held for clients right now, per
 * currency, at the top, with "+ Amanat"; then each amanat, still held first,
 * then the ones given back. Tapping one opens it, where "Given back" clears it.
 */
export function AmanatPage() {
  const t = useTranslations('amanat');
  const money = useShortMoney();
  const { workspace, can } = useWorkspace();
  const list = useAmanat(workspace.id);
  const accounts = useDaySummary(workspace.id).data?.accounts.map((p) => p.account) ?? [];
  const [holding, setHolding] = useState(false);
  const [opened, setOpened] = useState<AmanatRow | null>(null);
  const rows = list.data ?? [];
  const held = rows.filter((r) => !r.returned);
  const back = rows.filter((r) => r.returned);
  const totals = heldTotals(rows);

  const section = (title: string, items: AmanatRow[]) =>
    items.length === 0 ? null : (
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-semibold">{title}</h2>
        <ul>
          <AnimatePresence initial={false}>
            {items.map((row) => (
              <Row key={row.amanat.id} row={row} onOpen={setOpened} />
            ))}
          </AnimatePresence>
        </ul>
      </section>
    );

  return (
    <div className="flex w-full flex-col gap-6 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">{t('heldNow')}</span>
          <span className="flex flex-wrap items-baseline gap-x-3 text-3xl font-bold tabular-nums">
            {totals.length === 0 ? (
              <span className="text-muted-foreground">0</span>
            ) : (
              totals.map((m, index) => (
                <span key={m.currency} className="flex items-baseline gap-3">
                  {index > 0 ? <span aria-hidden className="bg-border h-6 w-px self-center" /> : null}
                  {money(m)}
                </span>
              ))
            )}
          </span>
        </div>
        {can('record') ? (
          <Button type="button" onClick={() => setHolding(true)} className="h-9 rounded-lg px-3 text-sm font-semibold">
            <PlusIcon data-icon="inline-start" />
            {t('add')}
          </Button>
        ) : null}
      </header>

      {!list.data ? (
        <div className="bg-card h-20 animate-pulse rounded-xl" />
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-base">{t('none')}</p>
      ) : (
        <>
          {section(t('heldSection'), held)}
          {section(t('returnedSection'), back)}
        </>
      )}

      <HoldSheet open={holding} onOpenChange={setHolding} accounts={accounts} />
      <AmanatSheet row={opened} accounts={accounts} onClose={() => setOpened(null)} />
    </div>
  );
}
