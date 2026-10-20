import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabasePublishableKey, supabaseUrl } from './env';

// Supabase on the server (server components, server actions, route handlers),
// acting as the signed-in user from the request's cookies, so row-level
// security applies. Make a new one per request; never share it.
//
// Not used yet (Phase 1a): server actions and proxy.ts start using it in 1c.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server components can't set cookies. Fine: proxy.ts refreshes the
          // session on every request (from 1c), so nothing is lost.
        }
      },
    },
  });
}
