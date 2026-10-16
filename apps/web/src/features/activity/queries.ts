'use client';

import type { Id } from '@sarrif/core';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** Who did what on a day, newest first (only asked for while the drawer is open). */
export function useActivity(workspaceId: Id, date: string, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.activity(workspaceId, date), queryFn: () => api.activity.list(workspaceId, date), enabled });
}
