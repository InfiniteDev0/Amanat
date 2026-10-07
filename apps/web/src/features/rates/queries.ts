'use client';

import type { Id, SetRatesInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export function useRates(workspaceId: Id, date: string) {
  return useQuery({ queryKey: queryKeys.rates(workspaceId, date), queryFn: () => api.rates.forDate(workspaceId, date) });
}

export function useSetRates(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetRatesInput) => api.rates.set(workspaceId, input),
    // New rates change profit and the value of every balance: refresh the shop.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}
