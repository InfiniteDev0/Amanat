import { createBrowserClient } from '@supabase/ssr';

import { supabasePublishableKey, supabaseUrl } from './env';

// Supabase in the browser (client components). The session lives in cookies,
// shared with the server, so it's the same user on both sides. createBrowserClient
// returns one shared client per page, so calling this often is fine.
//
// Only lib/api/supabase calls this: screens keep talking to `api` (lib/api).
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
