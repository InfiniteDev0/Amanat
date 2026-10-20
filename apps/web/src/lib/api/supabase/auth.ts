import {
  ApiError,
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

import { createClient } from '@/lib/supabase/client';

// Sign-in against Supabase Auth (Phase 1b): email + password, or Google. The
// rest of the app still runs on the in-browser mock, which is told who signed
// in (`MockSession`) so the shops it holds belong to the real account.
//
// The profile (name, phone, language, terms) is the `profiles` row, which RLS
// lets each person read and change for themselves only
// (supabase/migrations/*_profiles.sql).

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

/** Where email links and Google send people back: the callback swaps the code for a session, then goes to `next`. */
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

/**
 * Supabase's errors as ours. A wrong password and an unknown email are both
 * `invalid_credentials`, and both become "Email or password is wrong".
 */
function authError(error: AuthError): ApiError {
  switch (error.code) {
    case 'invalid_credentials':
      return new ApiError('unauthenticated', 'errors.wrongLogin', { form: 'errors.wrongLogin' });
    case 'email_not_confirmed':
      return new ApiError('forbidden', 'errors.emailNotConfirmed', { form: 'errors.emailNotConfirmed' });
    case 'weak_password':
      return new ApiError('invalid', 'validation.passwordWeak', { password: 'validation.passwordWeak' });
    case 'same_password':
      return new ApiError('invalid', 'validation.passwordSame', { password: 'validation.passwordSame' });
    case 'email_address_invalid':
    case 'validation_failed':
      return new ApiError('invalid', 'validation.email', { email: 'validation.email' });
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new ApiError('rate_limited');
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return new ApiError('invalid', 'errors.linkExpired', { form: 'errors.linkExpired' });
    case 'session_not_found':
    case 'refresh_token_not_found':
      return new ApiError('unauthenticated');
    default:
      // No code and no status: the request never reached Supabase.
      if (!error.status) return new ApiError('unavailable');
      return new ApiError('invalid', 'errors.unknown', { form: 'errors.unknown' });
  }
}

function databaseError(error: PostgrestError): ApiError {
  if (error.code === '23514') return new ApiError('invalid', 'validation.phone', { phone: 'validation.phone' });
  if (error.code === '42501' || error.code === 'PGRST301') return new ApiError('unauthenticated');
  return new ApiError('unavailable');
}

export function supabaseAuth(mock: MockSession): SarrifApi['auth'] {
  const supabase = () => createClient();

  /** The signed-in user with their profile, or null; the mock learns who it is. */
  async function currentUser(): Promise<User | null> {
    const { data, error } = await supabase().auth.getUser();
    if (error || !data.user) {
      // Signed out is an answer; a failed request isn't.
      if (error && error.name !== 'AuthSessionMissingError' && error.code !== 'session_not_found' && !error.status) {
        throw new ApiError('unavailable');
      }
      mock.adopt(null);
      return null;
    }
    const user = await withProfile(data.user);
    mock.adopt(user);
    return user;
  }

  async function withProfile(authUser: AuthUser): Promise<User> {
    const { data, error } = await supabase().from('profiles').select(PROFILE_COLUMNS).eq('id', authUser.id).single<ProfileRow>();
    if (error) throw databaseError(error);
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
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl(`/${language}`),
          // The profiles trigger reads these. The phone comes later, in the setup wizard.
          data: { first_name: firstName, language, terms_version: TERMS_VERSION },
        },
      });
      if (error) {
        // Never say the address is taken: answer as for a new one.
        if (error.code === 'user_already_exists' || error.code === 'email_exists') return { status: 'confirm_email' };
        throw authError(error);
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
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw authError(error);
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    async signInWithGoogle(input) {
      const { language } = parse(googleSignInSchema, input);
      const { error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl(`/${language}`) },
      });
      if (error) throw authError(error);
      // The browser is on its way to Google now.
    },

    async resendConfirmation(input) {
      const { email, language } = parse(emailLinkSchema, input);
      const { error } = await supabase().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callbackUrl(`/${language}`) },
      });
      if (error && error.code !== 'user_not_found') throw authError(error);
    },

    async requestPasswordReset(input) {
      const { email, language } = parse(emailLinkSchema, input);
      const { error } = await supabase().auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl(`/${language}/reset-password`),
      });
      // Unknown addresses get the same "check your email" as known ones.
      if (error && error.code !== 'user_not_found') throw authError(error);
    },

    async setNewPassword(input) {
      const { password } = parse(newPasswordSchema, input);
      const { error } = await supabase().auth.updateUser({ password });
      if (error) throw authError(error);
    },

    async completeProfile(input) {
      const { phone, acceptTerms } = parse(completeProfileSchema, input);
      const { data } = await supabase().auth.getUser();
      if (!data.user) throw new ApiError('unauthenticated');
      // terms_accepted_at is stamped by the database when terms_version changes.
      const change = acceptTerms ? { phone, terms_version: TERMS_VERSION } : { phone };
      const { error } = await supabase().from('profiles').update(change).eq('id', data.user.id);
      if (error) throw databaseError(error);
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    getSession: currentUser,

    async updateProfile(input) {
      const { name, language } = parse(profileSchema, input);
      const { data } = await supabase().auth.getUser();
      if (!data.user) throw new ApiError('unauthenticated');
      const { error } = await supabase().from('profiles').update({ first_name: name, language }).eq('id', data.user.id);
      if (error) throw databaseError(error);
      const user = await withProfile(data.user);
      mock.adopt(user);
      return user;
    },

    async signOut() {
      const { error } = await supabase().auth.signOut();
      if (error && error.code !== 'session_not_found') throw authError(error);
      mock.adopt(null);
    },
  };
}
