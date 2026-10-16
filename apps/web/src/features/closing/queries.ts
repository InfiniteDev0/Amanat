'use client';

import type { CloseDayInput, Id, ReopenDayInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Close day for one day: what each account should hold, and the counts once it's closed. */
export function useClosingDay(workspaceId: Id, date: string, enabled = true) {
  return useQuery({ queryKey: queryKeys.closing(workspaceId, date), queryFn: () => api.closings.day(workspaceId, date), enabled });
}

/** Closing or reopening locks or unlocks every row of the day, so the whole shop refreshes. */
export function useCloseDay(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CloseDayInput) => api.closings.close(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

export function useReopenDay(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReopenDayInput) => api.closings.reopen(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}
