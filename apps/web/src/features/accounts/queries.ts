'use client';

import type { CreateAccountInput, Id } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

export function useAccounts(workspaceId: Id) {
  return useQuery({ queryKey: queryKeys.accounts(workspaceId), queryFn: () => api.accounts.list(workspaceId) });
}

export function useCreateAccount(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAccountInput) => api.accounts.create(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}
