'use client';

import type { CreateAccountInput, Id, UpdateAccountInput } from '@sarrif/core';
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

/** Owners: set an account's opening balance. Every balance in the shop follows. */
export function useUpdateAccount(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, input }: { accountId: Id; input: UpdateAccountInput }) => api.accounts.update(workspaceId, accountId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}
