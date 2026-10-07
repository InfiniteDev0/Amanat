'use client';

import type { Id } from '@sarrif/core';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Everything Home shows for a day (today when no date is given). */
export function useDaySummary(workspaceId: Id, date?: string) {
  return useQuery({ queryKey: queryKeys.summary(workspaceId, date), queryFn: () => api.summary.day(workspaceId, date) });
}
