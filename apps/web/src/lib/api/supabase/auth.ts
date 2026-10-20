import {
  ApiError,
  appReturnPath,
  completeProfileSchema,
  emailLinkSchema,
  googleSignInSchema,
  type Language,
  logInSchema,
  newPasswordSchema,
  profileSchema,
  type SarrifApi,
  signUpSchema,
  TERMS_VERSION,
  type User,
} from '@sarrif/core';
import type { AuthError, PostgrestError, User as AuthUser } from '@supabase/supabase-js';
import type { ZodType } from 'zod';

import { reportError } from '@/lib/report-error';
import { createClient } from '@/lib/supabase/client';

// Sign-in against Supabase Auth (Phase 1b): email + password, or Google. The
// rest of the app still runs on the in-browser mock, which is told who signed
// in (`MockSession`) so the shops it holds belong to the real account.
//
// The profile (name, phone, language, terms) is the `profiles` row, which RLS
// lets each person read and change for themselves only
// (supabase/migrations/*_profiles.sql).
//
// Nothing raw reaches the screen: every failure becomes an ApiError with a
// translated message, and anything unexpected also goes to reportError.

/** The mock's side of the bridge: who is signed in now, or nobody. */
export interface MockSession {
  adopt(user: User | null): void;
}

interface ProfileRow {
  first_name: string;
  phone: string | null;
  language: Language;
  terms_accepted_at: string | null;
  created_at: string;
}

const PROFILE_COLUMNS = 'first_name, phone, language, terms_accepted_at, created_at';

/** Past this, a request counts as lost: "No connection. Try again." */
const TIMEOUT_MS = 15_000;

/**
 * Where email links land (sign-up confirmation, password reset). The email
 * templates add the one-time token to this URL (supabase/templates), so the
 * link works on any device; /api/auth/confirm checks it and goes on to `next`.
 */
function confirmUrl(next: string): string {
  return `${window.location.origin}/api/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Where Google sends people back: /api/auth/callback swaps the code for a session, then goes on to `next`. */
function callbackUrl(next: string): string {
  return `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) fields[issue.path.join('.')] ??= issue.message;
    throw new ApiError('invalid', 'errors.invalid', fields);
  }
  return result.data;
}

const formError = (code: ConstructorParameters<typeof ApiError>[0], key: string) => new ApiError(code, key, { form: key });

/** Stops waiting after TIMEOUT_MS. The request may still finish; the person can simply try again. */
async function withTimeout<T>(work: Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw formError('unavailable', 'errors.offline');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(formError('unavailable', 'errors.timeout')), TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Supabase's errors as ours. A wrong password and an unknown email are both
 * `invalid_credentials`, and both become "Email or password is wrong".
 */
function authError(error: AuthError, during: string): ApiError {
  switch (error.code) {
    case 'invalid_credentials':
      return formError('unauthenticated', 'errors.wrongLogin');
    case 'email_not_confirmed':
      return formError('forbidden', 'errors.emailNotConfirmed');
    case 'weak_password':
      return new ApiError('invalid', 'validation.passwordWeak', { password: 'validation.passwordWeak' });
    case 'same_password':
      return new ApiError('invalid', 'validation.passwordSame', { password: 'validation.passwordSame' });
    case 'email_address_invalid':
    case 'validation_failed':
      return new ApiError('invalid', 'validation.email', { email: 'validation.email' });
    case 'over_email_send_rate_limit':
      return formError('rate_limited', 'errors.tooManyEmails');
    case 'over_request_rate_limit':
      return formError('rate_limited', 'errors.tooManyAttempts');
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return formError('invalid', 'errors.linkExpired');
    case 'session_not_found':
    case 'refresh_token_not_found':
      return new ApiError('unauthenticated');
  }
  if (error.status === 429) return formError('rate_limited', 'errors.tooManyAttempts');
  // No status: the request never got an answer.
  if (!error.status) return formError('unavailable', 'errors.offline');
  reportError(error, { during, code: error.code, status: error.status });
  // The profile trigger failing makes sign-up fail as a whole (same transaction): nothing half-made.
  if (error.code === 'unexpected_failure' || error.status >= 500) {
    return formError('unavailable', during === 'signUp' ? 'errors.signUpFailed' : 'errors.serviceDown');
  }
  return formError('invalid', 'errors.unknown');
}

function databaseError(error: PostgrestError, during: string): ApiError {
  if (error.code === '23514') return new ApiError('invalid', 'validation.phone', { phone: 'validation.phone' });
  if (error.code === '42501' || error.code === 'PGRST301') return new ApiError('unauthenticated');
  reportError(error, { during, code: error.code });
  return formError('unavailable', 'errors.serviceDown');
}

export function supabaseAuth(mock: MockSession): SarrifApi['auth'] {
  const supabase = () => createClient();

  /** The signed-in user with their profile, or null; the mock learns who it is. */
  async function currentUser(): Promise<User | null> {
    const { data, error } = await withTimeout(supabase().auth.getUser());
    if (error || !data.user) {
      // Signed out is an answer; a failed request isn't.
      if (error && error.name !== 'AuthSessionMissingError' && error.code !== 'session_not_found' && !error.status) {
        throw formError('unavailable', 'errors.offline');
      }
      mock.adopt(null);
      return null;
    }
    const user = await withProfile(data.user);
    mock.adopt(user);
    return user;
  }

  async function withProfile(authUser: AuthUser): Promise<User> {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase().from('profiles').select(PROFILE_COLUMNS).eq('id', authUser.id).single<ProfileRow>()),
    );
    if (error) throw databaseError(error, 'profile');
    const picture = authUser.user_metadata?.avatar_url;
    return {
      id: authUser.id,
      name: data.first_name,
      phone: data.phone ?? '',
      email: authUser.email ?? null,
      avatar: typeof picture === 'string' && picture.startsWith('https://') ? picture : null,
      language: data.language,
      createdAt: data.created_at,
      termsAcceptedAt: data.terms_accepted_at,
    };
  }

  return {
    async signUp(input) {
      const { firstName, email, password, language } = parse(signUpSchema, input);
      const { data, error } = await withTimeout(
        supabase().auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: confirmUrl(`/${language}`),
            // The profiles trigger reads these. The phone comes later, in the setup wizard.
            data: { first_name: firstName, language, terms_version: TERMS_VERSION },
          },
        }),
      );
      if (error) {
        // Never say the address is taken: answer as for a new one.
        if (error.code === 'user_already_exists' || error.code === 'email_exists') return { status: 'confirm_email' };
        throw authError(error, 'signUp');
      }
      // A session means email confirmation is off for this project.
      if (data.session && data.user) {
        const user = await withProfile(data.user);
        mock.adopt(user);
        return { status: 'signed_in', user };
      }
      return { status: 'confirm_email' };
    },

    async logIn(input) {
      const { email, password } = parse(logInSchema, input);
      const { data, error } = await withTimeout(supabase().auth.signInWithPassword({ email, password }));
      if (error) throw authError(error, 'logIn');
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    async signInWithGoogle(input) {
      const { language, next } = parse(googleSignInSchema, input);
      const back = appReturnPath(next);
      const { error } = await withTimeout(
        supabase().auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: callbackUrl(back ? `/${language}?next=${encodeURIComponent(back)}` : `/${language}`) },
        }),
      );
      if (error) throw authError(error, 'google');
      // The browser is on its way to Google now.
    },

    async resendConfirmation(input) {
      const { email, language } = parse(emailLinkSchema, input);
      const { error } = await withTimeout(
        supabase().auth.resend({ type: 'signup', email, options: { emailRedirectTo: confirmUrl(`/${language}`) } }),
      );
      if (error && error.code !== 'user_not_found') throw authError(error, 'resend');
    },

    async requestPasswordReset(input) {
      const { email, language } = parse(emailLinkSchema, input);
      const { error } = await withTimeout(
        supabase().auth.resetPasswordForEmail(email, { redirectTo: confirmUrl(`/${language}/reset-password`) }),
      );
      // Unknown addresses get the same "check your email" as known ones.
      if (error && error.code !== 'user_not_found') throw authError(error, 'reset');
    },

    async setNewPassword(input) {
      const { password } = parse(newPasswordSchema, input);
      const { error } = await withTimeout(supabase().auth.updateUser({ password }));
      if (error) throw authError(error, 'newPassword');
    },

    async completeProfile(input) {
      const { phone, acceptTerms } = parse(completeProfileSchema, input);
      const { data } = await withTimeout(supabase().auth.getUser());
      if (!data.user) throw new ApiError('unauthenticated');
      // terms_accepted_at is stamped by the database when terms_version changes.
      const change = acceptTerms ? { phone, terms_version: TERMS_VERSION } : { phone };
      const { error } = await withTimeout(Promise.resolve(supabase().from('profiles').update(change).eq('id', data.user.id)));
      if (error) throw databaseError(error, 'completeProfile');
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    getSession: currentUser,

    async updateProfile(input) {
      const { name, language } = parse(profileSchema, input);
      const { data } = await withTimeout(supabase().auth.getUser());
      if (!data.user) throw new ApiError('unauthenticated');
      const { error } = await withTimeout(
        Promise.resolve(supabase().from('profiles').update({ first_name: name, language }).eq('id', data.user.id)),
      );
      if (error) throw databaseError(error, 'updateProfile');
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    async signOut(options) {
      // Ends the session on the server too (it can't be used again), and
      // Supabase tells this browser's other tabs. 'global' ends every session
      // of this user: other devices are signed out on their next request.
      const scope = options?.everywhere ? 'global' : 'local';
      const { error } = await withTimeout(supabase().auth.signOut({ scope }));
      if (error && error.code !== 'session_not_found') throw authError(error, 'signOut');
      mock.adopt(null);
    },

    onSignedOut(listener) {
      // Fires here for a sign-out in another tab, and for a session that ended.
      const { data } = supabase().auth.onAuthStateChange((event) => {
        if (event !== 'SIGNED_OUT') return;
        mock.adopt(null);
        listener();
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
