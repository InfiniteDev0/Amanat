import { SETUP_PAGE } from '@sarrif/core';
import { redirect } from 'next/navigation';

import { SUPABASE_CONFIGURED } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

// "Who is this?" on the server, for layouts, route handlers and server
// actions. Always checked with Supabase (getUser), never read from the
// cookie as it stands (getSession): a tampered or signed-out cookie is nobody.
//
// The door (proxy.ts) checks first, with the routing table in core
// (routing.ts); these are the second check, so a page never renders for
// someone who isn't allowed on it, whatever the proxy did.

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
 * The signed-in user whose setup is finished (main shop, phone and terms,
 * all saved in one transaction), or a redirect to All shops, where the setup
 * wizard opens.
 */
export async function requireOnboarded(locale: string): Promise<ServerUser> {
  const user = await requireUser(locale);
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).single();
  if (!data?.onboarding_completed_at) redirect(`/${locale}${SETUP_PAGE}`);
  return user;
}

/**
 * requireOnboarded, and the shop in the URL is theirs: row-level security
 * returns only the shops they own, so anyone else's (or a made-up id) goes
 * back to All shops, which opens their own. Team members come in 1e.
 */
export async function requireShop(locale: string, shopId: string): Promise<ServerUser> {
  const user = await requireOnboarded(locale);
  const supabase = await createClient();
  const { data } = await supabase.from('shops').select('id').eq('id', shopId).maybeSingle();
  if (!data) redirect(`/${locale}${SETUP_PAGE}`);
  return user;
}
