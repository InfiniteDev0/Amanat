'use client';

import type { HoldAmanatInput, Id } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
