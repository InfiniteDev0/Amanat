'use client';

import type { BookFilter, Id } from '@sarrif/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** The Book for one day, newest first. Keeps the old rows on screen while a new filter loads. */
export function useBook(workspaceId: Id, filter: BookFilter = {}) {
  return useQuery({
    queryKey: queryKeys.book(workspaceId, filter),
    queryFn: () => api.book.list(workspaceId, filter),
    placeholderData: keepPreviousData,
  });
}
