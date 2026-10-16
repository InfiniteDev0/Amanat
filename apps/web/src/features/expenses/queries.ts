'use client';

import type { Id } from '@sarrif/core';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** One day's expenses (today when no date is given), oldest first. */
export function useExpenses(workspaceId: Id, date?: string) {
  return useQuery({ queryKey: queryKeys.expenses(workspaceId, date), queryFn: () => api.expenses.list(workspaceId, date) });
}
