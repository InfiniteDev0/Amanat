'use client';

import type { CurrencyCode, Id, SetRatesInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Today's mid-market reference rates against `base` (a guide, not the shop's rate). Refreshed hourly. */
export function useMarketRates(base: CurrencyCode | null) {
  return useQuery({
    queryKey: queryKeys.market(base ?? ''),
    queryFn: () => api.market.rates(base as CurrencyCode),
    enabled: base !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}

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
