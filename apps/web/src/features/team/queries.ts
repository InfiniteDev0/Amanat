'use client';

import type { Id, InviteInput, Role } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Everyone in the shop and the invitations still open (Owners). */
export function useTeam(workspaceId: Id) {
  return useQuery({ queryKey: queryKeys.team(workspaceId), queryFn: () => api.team.list(workspaceId) });
}

function useTeamMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>, workspaceId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspaceId) }),
  });
}

export const useInvite = (workspaceId: Id) => useTeamMutation((input: InviteInput) => api.team.invite(workspaceId, input), workspaceId);

export const useCancelInvite = (workspaceId: Id) => useTeamMutation((invitationId: Id) => api.team.cancelInvite(workspaceId, invitationId), workspaceId);

export const useSetRole = (workspaceId: Id) => useTeamMutation(({ memberId, role }: { memberId: Id; role: Role }) => api.team.setRole(workspaceId, memberId, role), workspaceId);

export const useRemoveMember = (workspaceId: Id) => useTeamMutation((memberId: Id) => api.team.remove(workspaceId, memberId), workspaceId);
