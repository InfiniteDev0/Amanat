'use client';

import type { Id, Notification } from '@sarrif/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Checked again every minute, so a reminder due at 9:00 shows up without a refresh. */
const REFRESH_MS = 60_000;

/** Your notifications from every shop you're in, newest first. */
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.notifications.list(),
    refetchInterval: REFRESH_MS,
  });
}

/**
 * A change to some notifications, shown straight away (the list is edited in
 * the cache first) and put back if the backend refuses.
 */
function useNotificationChange(send: (ids: Id[]) => Promise<void>, change: (list: Notification[], ids: Set<Id>) => Notification[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const before = queryClient.getQueryData<Notification[]>(queryKeys.notifications);
      if (before) queryClient.setQueryData(queryKeys.notifications, change(before, new Set(ids)));
      return { before };
    },
    onError: (_error, _ids, context) => {
      if (context?.before) queryClient.setQueryData(queryKeys.notifications, context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkNotificationsRead() {
  return useNotificationChange(
    (ids) => api.notifications.markRead(ids),
    (list, ids) => {
      const now = new Date().toISOString();
      return list.map((n) => (ids.has(n.id) && !n.readAt ? { ...n, readAt: now } : n));
    },
  );
}

export function useClearNotifications() {
  return useNotificationChange(
    (ids) => api.notifications.clear(ids),
    (list, ids) => list.filter((n) => !ids.has(n.id)),
  );
}

/** The Undo after clearing: they come back with the next fetch. */
export function useRestoreNotifications() {
  return useNotificationChange(
    (ids) => api.notifications.restore(ids),
    (list) => list,
  );
}
