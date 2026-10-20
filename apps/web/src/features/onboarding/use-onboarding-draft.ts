'use client';

import type { Language, User } from '@sarrif/core';
import { useCallback, useRef, useState } from 'react';

import { initialDraft, loadDraft, type OnboardingDraft, saveDraft } from './draft';
import { readSignupCurrencies } from './signup-currencies';

/**
 * The wizard's state. Picks up where this person left off in this tab, or
 * starts from their account (name, photo, phone if they have one).
 *
 * `update` saves synchronously, so a change made just before a page reload
 * (picking a language reloads the page in that language) is never lost.
 */
export function useOnboardingDraft(user: User, locale: Language) {
  // Whether the terms are still to be agreed always comes from the account, never from a saved draft.
  const termsNeeded = user.termsAcceptedAt === null;
  const [draft, setDraft] = useState<OnboardingDraft>(() => {
    const saved = loadDraft(user.id);
    if (saved) return { ...saved, termsNeeded };
    return initialDraft({
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      phone: user.phone,
      termsNeeded,
      language: locale,
      currencies: readSignupCurrencies(),
    });
  });
  const latest = useRef(draft);

  const update = useCallback((change: (draft: OnboardingDraft) => OnboardingDraft) => {
    const next = change(latest.current);
    latest.current = next;
    saveDraft(next);
    setDraft(next);
  }, []);

  return { draft, update };
}
