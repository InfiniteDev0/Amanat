'use client';

import type {
  CreateAmanatInput,
  CreateDebtInput,
  CreateDebtPaymentInput,
  CreateExchangeInput,
  CreateExpenseInput,
  CreateTransferInput,
  Id,
} from '@sarrif/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

// The five "+ New" actions. Each one touches balances, the Book and Home, so
// a success refreshes everything cached for the shop. When the forms are
// built, each moves next to its form (features/exchange, features/expense…)
// as the tech doc lays out; the hooks keep the same names.

function useRecord<TInput, TResult>(create: (workspaceId: Id, input: TInput) => Promise<TResult>, workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => create(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

export const useCreateExchange = (workspaceId: Id) =>
  useRecord((id, input: CreateExchangeInput) => api.records.createExchange(id, input), workspaceId);

export const useCreateExpense = (workspaceId: Id) =>
  useRecord((id, input: CreateExpenseInput) => api.records.createExpense(id, input), workspaceId);

export const useCreateAmanat = (workspaceId: Id) =>
  useRecord((id, input: CreateAmanatInput) => api.records.createAmanat(id, input), workspaceId);

export const useCreateDebt = (workspaceId: Id) =>
  useRecord((id, input: CreateDebtInput) => api.records.createDebt(id, input), workspaceId);

export const useCreateDebtPayment = (workspaceId: Id) =>
  useRecord((id, input: CreateDebtPaymentInput) => api.records.createDebtPayment(id, input), workspaceId);

export function useCreateTransfer(workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransferInput) => api.records.createTransfer(workspaceId, input),
    onSuccess: (transfer) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) });
      // Shop to shop: the receiving shop's balances changed too.
      if (transfer.toWorkspaceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workspace(transfer.toWorkspaceId) });
      }
    },
  });
}
