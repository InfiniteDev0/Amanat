'use client';

import type {
  CompleteProfileInput,
  EmailLinkInput,
  GoogleSignInInput,
  LogInInput,
  NewPasswordInput,
  ProfileInput,
  SignUpInput,
  User,
} from '@sarrif/core';
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** The signed-in user, or null. */
export function useSession() {
  return useQuery({ queryKey: queryKeys.session, queryFn: () => api.auth.getSession() });
}

/** Someone new signed in on this browser: drop whatever the last person had loaded. */
function startFresh(queryClient: QueryClient, user: User) {
  queryClient.clear();
  queryClient.setQueryData(queryKeys.session, user);
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SignUpInput) => api.auth.signUp(input),
    onSuccess: (result) => {
      if (result.status === 'signed_in') startFresh(queryClient, result.user);
    },
  });
}

export function useLogIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LogInInput) => api.auth.logIn(input),
    onSuccess: (user) => startFresh(queryClient, user),
  });
}

export function useGoogleSignIn() {
  return useMutation({ mutationFn: (input: GoogleSignInInput) => api.auth.signInWithGoogle(input) });
}

export function useResendConfirmation() {
  return useMutation({ mutationFn: (input: EmailLinkInput) => api.auth.resendConfirmation(input) });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (input: EmailLinkInput) => api.auth.requestPasswordReset(input) });
}

export function useSetNewPassword() {
  return useMutation({ mutationFn: (input: NewPasswordInput) => api.auth.setNewPassword(input) });
}

export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteProfileInput) => api.auth.completeProfile(input),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.session, user),
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
