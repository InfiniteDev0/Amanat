import { ApiError } from '@sarrif/core';
import type { PostgrestError } from '@supabase/supabase-js';
import type { ZodType } from 'zod';

import { reportError } from '@/lib/report-error';

// What every Supabase adapter shares: input checks, a time limit, and
// database errors turned into ours. Nothing raw reaches the screen: every
// failure becomes an ApiError with a translated message, and anything
// unexpected also goes to reportError.

/** Past this, a request counts as lost: "No connection. Try again." */
const TIMEOUT_MS = 15_000;

export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[issue.path.join('.')] ??= issue.message;
    throw new ApiError('invalid', 'errors.invalid', fields);
  }
  return result.data;
}

export const formError = (code: ConstructorParameters<typeof ApiError>[0], key: string) => new ApiError(code, key, { form: key });

/** Stops waiting after TIMEOUT_MS. The request may still finish; the person can simply try again. */
export async function withTimeout<T>(work: PromiseLike<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw formError('unavailable', 'errors.offline');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(formError('unavailable', 'errors.timeout')), TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(work), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A database error as ours: signed out, not found (or not yours: RLS hides it), or the service is down. */
export function databaseError(error: PostgrestError, during: string): ApiError {
  if (error.code === '42501' || error.code === 'PGRST301') return new ApiError('unauthenticated');
  // `.single()` found no row: it doesn't exist, or row-level security hides it.
  if (error.code === 'PGRST116') return new ApiError('not_found');
  reportError(error, { during, code: error.code });
  return formError('unavailable', 'errors.serviceDown');
}
