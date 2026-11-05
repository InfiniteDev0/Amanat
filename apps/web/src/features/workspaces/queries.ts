'use client';

import type { CreateShopInput, CreateWorkspaceInput, UpdateWorkspaceInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Every shop the user belongs to, with their role in each. */
/** `enabled: false` waits (e.g. until someone is signed in). */
export function useMyWorkspaces({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.listMine(), enabled });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => api.workspaces.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

/** + New shop: another shop with its accounts and opening amounts (one transaction). */
export function useCreateShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShopInput) => api.workspaces.createShop(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

/** Moves the ★ to this shop. */
export function useSetMainShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => api.workspaces.setMain(workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

/** Deletes a shop that isn't the main one. */
export function useRemoveShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => api.workspaces.remove(workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}

/** Owners: the shop's name, place, closing time and large-row limit. The shop list carries them, so it refreshes. */
export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => api.workspaces.update(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}
