'use client';

import type { OnboardingProgress } from '@sarrif/core';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query/keys';

/** The step and answers saved so far, or null: read once when the wizard opens. */
export function useOnboardingProgress({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.onboardingProgress,
    queryFn: () => api.onboarding.progress(),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}

/** Keeps the wizard's place on the profile. A failed save is quiet: this tab still has the draft. */
export function useSaveOnboardingProgress() {
  return useMutation({ mutationFn: (progress: OnboardingProgress) => api.onboarding.saveProgress(progress) });
}
