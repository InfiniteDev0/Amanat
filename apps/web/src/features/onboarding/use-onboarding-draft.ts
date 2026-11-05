'use client';

import type { Language, OnboardingProgress, User } from '@sarrif/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { initialDraft, loadDraft, type OnboardingDraft, progressOf, restoreDraft, saveDraft } from './draft';
import { useSaveOnboardingProgress } from './queries';

/** How long after the last keystroke the answers are saved to the profile. */
const SAVE_AFTER_MS = 1000;

/**
 * The wizard's state. Picks up where this person left off: this tab's copy
 * first (the freshest), else the one saved on their profile (another tab or
 * device, or after closing), else a fresh start from their account (name,
 * photo, phone if they have one).
 *
 * Every change is kept in this tab at once (picking a language reloads the
 * page). It's saved to the profile straight away when the step changes, and
 * a moment after typing stops otherwise.
 */
export function useOnboardingDraft(user: User, locale: Language, saved: OnboardingProgress | null) {
  // Whether the terms are still to be agreed always comes from the account, never from a saved draft.
  const termsNeeded = user.termsAcceptedAt === null;
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const resumed = loadDraft(user.id) ?? (saved ? restoreDraft({ ...saved.data, step: saved.step }, user.id) : null);
    if (resumed) return { ...resumed, avatar: resumed.avatar ?? user.avatar, termsNeeded };
    return initialDraft({ userId: user.id, name: user.name, avatar: user.avatar, phone: user.phone, termsNeeded, language: locale });
  });
  const latest = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { mutate: saveProgress } = useSaveOnboardingProgress();

  const update = useCallback(
    (change: (draft: OnboardingDraft) => OnboardingDraft) => {
      const before = latest.current;
      const next = change(before);
      latest.current = next;
      saveDraft(next);
      setDraft(next);
      clearTimeout(timer.current);
      if (next.step !== before.step) saveProgress(progressOf(next));
      else timer.current = setTimeout(() => saveProgress(progressOf(next)), SAVE_AFTER_MS);
    },
    [saveProgress],
  );

  // Closed before the timer fired: nothing more is sent (this tab keeps the draft).
  useEffect(() => () => clearTimeout(timer.current), []);

  return { draft, update };
}
