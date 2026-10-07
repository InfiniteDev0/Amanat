'use client';

import type { ProfileInput, SendCodeInput, VerifyCodeInput } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** The signed-in user, or null. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: () => api.auth.getSession() });
}

export function useSendCode() {
  return useMutation({ mutationFn: (input: SendCodeInput) => api.auth.sendCode(input) });
}

export function useVerifyCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VerifyCodeInput) => api.auth.verifyCode(input),
    onSuccess: ({ user }) => {
      // A different person may have used this browser before: start clean.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, user);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => api.auth.updateProfile(input),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.auth.signOut(),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, null);
    },
  });
}
