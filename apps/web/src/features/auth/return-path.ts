'use client';

import { appReturnPath } from '@sarrif/core';

/** The page to come back to after signing in (?next=… on the auth page), when it's one of the app's own; else null. */
export function returnPath(): string | null {
  if (typeof window === 'undefined') return null;
  return appReturnPath(new URLSearchParams(window.location.search).get('next'));
}
