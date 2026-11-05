// How this browser signed in last time, so the auth page can say "Last used"
// next to it. A cookie, not localStorage, because the Google sign-in finishes
// on the server (/api/auth/callback), which sets it; email log-in sets it here.
// Only a hint for the button, never used to decide anything.

export const LAST_SIGN_IN_COOKIE = 'amanat_last_sign_in';
export const LAST_SIGN_IN_MAX_AGE = 60 * 60 * 24 * 365;

export type SignInMethod = 'google' | 'email';

export function lastSignInMethod(): SignInMethod | null {
  if (typeof document === 'undefined') return null;
  const value = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${LAST_SIGN_IN_COOKIE}=`))
    ?.split('=')[1];
  return value === 'google' || value === 'email' ? value : null;
}

export function rememberSignInMethod(method: SignInMethod) {
  document.cookie = `${LAST_SIGN_IN_COOKIE}=${method}; path=/; max-age=${LAST_SIGN_IN_MAX_AGE}; samesite=lax`;
}
