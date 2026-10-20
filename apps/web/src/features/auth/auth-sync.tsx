'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/**
 * Signed out in another tab, or the session ended: this tab forgets
 * everything it had loaded and counts as signed out, so SessionGate sends it
 * to the auth page (with ?next= to come back). In the root providers, once.
 */
export function AuthSync() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      api.auth.onSignedOut(() => {
        if (queryClient.getQueryData(queryKeys.session) === null) return;
        queryClient.clear();
        queryClient.setQueryData(queryKeys.session, null);
      }),
    [queryClient],
  );
  return null;
}
