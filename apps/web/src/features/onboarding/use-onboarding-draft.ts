'use client';

import type { Language, User } from '@sarrif/core';
import { useCallback, useRef, useState } from 'react';

import { initialDraft, loadDraft, type OnboardingDraft, saveDraft } from './draft';
import { readSignupCurrencies } from './signup-currencies';

/**
 * The wizard's state. Picks up where this person left off in this tab, or
 * starts from what the Sign up tab collected (name, currencies).
 *
 * `update` saves synchronously, so a change made just before a page reload
 * (picking a language reloads the page in that language) is never lost.
 */
export function useOnboardingDraft(user: User, locale: Language) {
  const [draft, setDraft] = useState<OnboardingDraft>(
    () =>
      loadDraft(user.id) ??
      initialDraft({
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
        language: locale,
        currencies: readSignupCurrencies(),
      }),
  );
  const latest = useRef(draft);

  const update = useCallback((change: (draft: OnboardingDraft) => OnboardingDraft) => {
    const next = change(latest.current);
    latest.current = next;
    saveDraft(next);
    setDraft(next);
  }, []);

  return { draft, update };
}
