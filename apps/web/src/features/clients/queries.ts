'use client';

import type { CreateClientInput, Id } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export function useClients(workspaceId: Id) {
  return useQuery({ queryKey: queryKeys.clients(workspaceId), queryFn: () => api.clients.list(workspaceId) });
}

export function useCreateClient(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => api.clients.create(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients(workspaceId) }),
  });
}
