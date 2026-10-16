'use client';

import { ratedCurrencies } from '@sarrif/core';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useDaySummary } from '@/features/home/queries';
import { useShopDay } from '@/features/workspaces/shop-day';
import { useWorkspace } from '@/features/workspaces/workspace-context';
import { cn } from '@/lib/utils';

import { formatMarket } from './format-market';
import { RatesDialog } from './rates-dialog';

/**
 * Today's rate, on every page (at the end of the page tabs): "Today's rate
 * 129.61", or "Set today's rate" while it's missing. People who can set it
 * tap it to change it, right where they are.
 */
export function RateChip() {
  const t = useTranslations('rates');
  const { workspace, can } = useWorkspace();
  const { today } = useShopDay();
  const summary = useDaySummary(workspace.id).data;
  const [open, setOpen] = useState(false);
  if (!summary) return null;
  const rate = summary.board.rates.KES?.buy;
  const canSet = can('set_rates');

  return (
    <>
      <button
        type="button"
        disabled={!canSet}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          rate ? 'bg-card text-foreground enabled:hover:bg-card/70' : 'bg-orange-500/15 text-orange-600 enabled:hover:bg-orange-500/25 dark:text-orange-400',
        )}
      >
        {rate ? (
          <>
            <span className="text-muted-foreground">{t('chip')}</span>
            <bdi dir="ltr" className="font-semibold tabular-nums">
              {formatMarket(rate)}
            </bdi>
          </>
        ) : (
          t('chipMissing')
        )}
      </button>
      <RatesDialog open={open} onOpenChange={setOpen} workspaceId={workspace.id} date={today} currencies={ratedCurrencies(workspace)} board={summary.board} />
    </>
  );
}
