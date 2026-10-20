import { redirect } from 'next/navigation';

import { SUPABASE_CONFIGURED } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

// "Who is this?" on the server, for layouts, route handlers and (from 1e)
// server actions. Always checked with Supabase (getUser), never read from the
// cookie as it stands (getSession): a tampered or signed-out cookie is nobody.
//
// The door (proxy.ts) checks first; these are the second check, so a page
// never renders for someone who isn't signed in, whatever the proxy did.

export interface ServerUser {
  id: string;
  email: string | null;
}

/** False with the demo sign-in (no Supabase project): only the browser knows who that is. */
export const SERVER_AUTH = SUPABASE_CONFIGURED;

/** The signed-in user, checked with Supabase; null when signed out. */
export async function currentUser(): Promise<ServerUser | null> {
  if (!SERVER_AUTH) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

/** The signed-in user, or a redirect to the auth page. */
export async function requireUser(locale: string): Promise<ServerUser> {
  const user = await currentUser();
  if (!user) redirect(`/${locale}`);
  return user;
}

/**
 * The signed-in user with a phone and the terms agreed (from the profiles
 * row, which RLS lets them read), or a redirect to Complete your profile.
 */
export async function requireCompleteProfile(locale: string): Promise<ServerUser> {
  const user = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('phone, terms_accepted_at').eq('id', user.id).single();
  if (!data?.phone || !data.terms_accepted_at) redirect(`/${locale}/complete-profile`);
  return user;
}

export class NotMemberError extends Error {
  override name = 'NotMemberError';
}

/**
 * The signed-in user and their role in a shop, or NotMemberError.
 *
 * TODO(1d): shops and members still live in the browser's demo data, which
 * the server can't read, so membership can't be checked here yet: until 1d
 * creates workspace_members, this refuses everyone rather than pretend, and
 * the shop is checked in the browser (WorkspaceShell). 1d makes it read the
 * member's row (RLS-protected) and return { user, role }.
 */
export async function requireMember(locale: string, workspaceId: string): Promise<{ user: ServerUser; role: never }> {
  await requireUser(locale);
  throw new NotMemberError(`Membership of ${workspaceId} can't be checked on the server before Phase 1d.`);
}
