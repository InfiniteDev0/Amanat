'use client';

import type { HoldAmanatInput, Id } from '@sarrif/core';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Every amanat of the shop: held first, then given back. */
export function useAmanat(workspaceId: Id) {
  return useQuery({ queryKey: queryKeys.amanat(workspaceId), queryFn: () => api.amanat.list(workspaceId) });
}

/** Holding or giving back moves money in an account, so the whole shop refreshes. */
function useAmanatMutation<TInput>(run: (workspaceId: Id, input: TInput) => Promise<unknown>, workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

export const useHoldAmanat = (workspaceId: Id) => useAmanatMutation((id, input: HoldAmanatInput) => api.amanat.hold(id, input), workspaceId);

export const useReturnAmanat = (workspaceId: Id) => useAmanatMutation((id, amanatId: Id) => api.amanat.markReturned(id, amanatId), workspaceId);

export const useUndoReturn = (workspaceId: Id) => useAmanatMutation((id, amanatId: Id) => api.amanat.undoReturn(id, amanatId), workspaceId);

/** Every shop's amanat, for the Amanat page (one query per shop, shared with the shop's own). */
export function useAmanatOfShops(shopIds: Id[]) {
  return useQueries({ queries: shopIds.map((id) => ({ queryKey: queryKeys.amanat(id), queryFn: () => api.amanat.list(id) })) });
}

/** Every shop's Trash. */
export function useTrashedAmanat(shopIds: Id[]) {
  return useQueries({ queries: shopIds.map((id) => ({ queryKey: [...queryKeys.amanat(id), 'trash'] as const, queryFn: () => api.amanat.trashed(id) })) });
}

/** An action on one amanat of any shop: that shop refreshes. */
function useAmanatAction<TInput extends { shopId: Id }>(run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (_, input) => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(input.shopId) }),
  });
}

export const useHighlightAmanat = () => useAmanatAction(({ shopId, id, on }: { shopId: Id; id: Id; on: boolean }) => api.amanat.highlight(shopId, id, on));
export const useTrashAmanat = () => useAmanatAction(({ shopId, id }: { shopId: Id; id: Id }) => api.amanat.remove(shopId, id));
export const useRestoreAmanat = () => useAmanatAction(({ shopId, id }: { shopId: Id; id: Id }) => api.amanat.restore(shopId, id));
export const useDeleteAmanat = () => useAmanatAction(({ shopId, id }: { shopId: Id; id: Id }) => api.amanat.deleteForever(shopId, id));
export const useUpdateAmanat = () =>
  useAmanatAction(({ shopId, id, input }: { shopId: Id; id: Id; input: HoldAmanatInput }) => api.amanat.update(shopId, id, input));
export const useReturnAny = () => useAmanatAction(({ shopId, id }: { shopId: Id; id: Id }) => api.amanat.markReturned(shopId, id));
export const useUndoReturnAny = () => useAmanatAction(({ shopId, id }: { shopId: Id; id: Id }) => api.amanat.undoReturn(shopId, id));
