'use client';

import type { DaySummary, Id } from '@sarrif/core';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/**
 * A summary to show instead of asking the backend: the setup wizard's preview
 * draws the real Home from the answers so far, before the shop exists.
 */
export const PreviewSummaryContext = createContext<DaySummary | null>(null);

/** Everything Home shows for a day (today when no date is given). */
export function useDaySummary(workspaceId: Id, date?: string) {
  const preview = useContext(PreviewSummaryContext);
  const query = useQuery({
    queryKey: queryKeys.summary(workspaceId, date),
    queryFn: () => api.summary.day(workspaceId, date),
    enabled: preview === null,
  });
  return preview ? { ...query, data: preview } : query;
}
