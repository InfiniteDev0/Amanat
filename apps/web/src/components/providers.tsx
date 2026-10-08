'use client';

import { ApiError } from '@sarrif/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GooeyToaster } from 'goey-toast';
import { type ReactNode, useState } from 'react';

import type { Theme } from '@/features/theme/theme';

/** Errors that won't fix themselves by asking again. */
const FINAL_ERRORS = new Set(['unauthenticated', 'forbidden', 'not_found', 'invalid', 'day_closed']);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failures, error) => !(error instanceof ApiError && FINAL_ERRORS.has(error.code)) && failures < 2,
      },
    },
  });
}

export function Providers({ children, dir, theme }: { children: ReactNode; dir: 'ltr' | 'rtl'; theme: Theme }) {
  // One client per browser tab, created once.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <GooeyToaster position="top-center" dir={dir} theme={theme} />
    </QueryClientProvider>
  );
}
