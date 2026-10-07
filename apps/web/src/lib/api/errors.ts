'use client';

import { ApiError } from '@sarrif/core';
import { useTranslations } from 'next-intl';

/** Any thrown value as a translation key the user can read. */
export function errorKey(error: unknown): string {
  if (error instanceof ApiError) return error.messageKey;
  if (error instanceof TypeError) return 'errors.unavailable'; // fetch failed: offline
  return 'errors.unknown';
}

/**
 * Translates keys that arrive at runtime (API errors, schema issues), which
 * the typed `t` can't check ahead of time. Unknown keys fall back to a
 * generic message instead of showing the raw key.
 */
export function useMessage() {
  const t = useTranslations();
  return (key: string): string => (t.has(key as never) ? t(key as never) : t('errors.unknown'));
}
