'use client';

import type { CreateWorkspaceInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Every shop the user belongs to, with their role in each. */
export function useMyWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.listMine() });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) => api.workspaces.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
}
