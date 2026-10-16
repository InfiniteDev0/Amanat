'use client';

import type { CreateDealInput, Id } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** One day's rows of the exchange sheet (today when no date is given). */
export function useDeals(workspaceId: Id, date?: string) {
  return useQuery({ queryKey: queryKeys.deals(workspaceId, date), queryFn: () => api.deals.list(workspaceId, date) });
}

/** Colouring rows: the sheet refreshes. */
export function useHighlightDeals(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, colour }: { ids: Id[]; colour: string | null }) => api.deals.highlight(workspaceId, ids, colour),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

/** Deleting rows (and the Undo that brings them back) changes balances too. */
export function useRemoveDeals(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, restore }: { ids: Id[]; restore?: boolean }) =>
      restore ? api.deals.restore(workspaceId, ids) : api.deals.remove(workspaceId, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

/** A deal changed: both accounts and the profit move, so the whole shop refreshes. */
export function useUpdateDeal(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: CreateDealInput }) => api.deals.update(workspaceId, id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

/** A new deal: balances, profit and the list all change, so the whole shop refreshes. */
export function useCreateDeal(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDealInput) => api.deals.create(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}
