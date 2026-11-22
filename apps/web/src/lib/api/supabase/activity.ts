import type { ActivityAction, ActivityRow, CurrencyCode, SarrifApi } from '@sarrif/core';

import { createClient } from '@/lib/supabase/client';

import { databaseError, withTimeout } from './common';

// The activity log in the database (migration 20261123100000_activity): lines
// written by triggers as things happen, read one shop's day at a time through
// activity_of (that shop's lines, and the business's own: shops added or
// deleted, today's rate). A deleted shop's lines keep its name.

interface ActivityDbRow {
  id: string;
  shop_id: string | null;
  shop_name: string | null;
  user_id: string | null;
  user_name: string;
  action: ActivityAction;
  record_type: string;
  record_id: string | null;
  before: unknown;
  after: unknown;
  amount: number | null;
  currency: string | null;
  detail: string | null;
  reason: string | null;
  created_at: string;
}

export function supabaseActivity(): Pick<SarrifApi, 'activity'> {
  const supabase = () => createClient();
  return {
    activity: {
      async list(shopId, date) {
        const { data, error } = await withTimeout(supabase().rpc('activity_of', { shop: shopId, day: date }));
        if (error) throw databaseError(error, 'reading the activity log');
        return ((data ?? []) as ActivityDbRow[]).map(
          (row): ActivityRow => ({
            activity: {
              id: row.id,
              workspaceId: row.shop_id ?? shopId,
              userId: row.user_id ?? '',
              action: row.action,
              recordType: row.record_type,
              recordId: row.record_id ?? '',
              before: row.before,
              after: row.after,
              reason: row.reason,
              createdAt: row.created_at,
            },
            user: { id: row.user_id ?? '', name: row.user_name },
            money: row.amount !== null && row.currency ? { amount: Number(row.amount), currency: row.currency as CurrencyCode } : null,
            detail: row.detail,
          }),
        );
      },
    },
  };
}
