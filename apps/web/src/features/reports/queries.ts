'use client';

import type { Id } from '@sarrif/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Every day from `from` to `to` and the run added up. The last report stays on screen while the next loads. */
export function useReport(workspaceId: Id, from: string, to: string) {
  return useQuery({ queryKey: queryKeys.report(workspaceId, from, to), queryFn: () => api.reports.range(workspaceId, from, to), placeholderData: keepPreviousData });
}
