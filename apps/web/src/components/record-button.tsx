'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { CAN_RECORD } from '@/lib/api';

/**
 * The Save at the bottom of every money form (Exchange, Sallam, Move, Amanat,
 * Expense). Until the ledger is in the database (Phase 3) a real shop can't
 * record money yet: the form shows, and Save is off and says so. The demo
 * records as before.
 */
export function RecordButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  const t = useTranslations('form');
  return (
    <Button type="submit" disabled={disabled || !CAN_RECORD} className="h-14 w-full rounded-xl text-lg font-bold">
      {CAN_RECORD ? children : t('comingSoon')}
    </Button>
  );
}
