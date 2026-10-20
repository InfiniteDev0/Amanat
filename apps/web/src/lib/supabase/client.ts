import { createBrowserClient } from '@supabase/ssr';

import { supabasePublishableKey, supabaseUrl } from './env';

// Supabase in the browser (client components). The session lives in cookies
// that the server sets, so it's the same user on both sides.
//
// Not used yet (Phase 1a): screens keep talking to `api` (lib/api), and only
// the real SarrifApi implementation will call this.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
