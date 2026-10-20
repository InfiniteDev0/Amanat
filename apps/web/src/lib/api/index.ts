import type { SarrifApi } from '@sarrif/core';

import { SUPABASE_CONFIGURED } from '@/lib/supabase/env';

import { mockApi, mockSession } from './mock/mock-api';
import { supabaseAuth } from './supabase/auth';

// The one backend the UI talks to. Screens never import the mock, Supabase
// or fetch directly: they use the hooks in features/*/queries.ts, which call
// `api`. The real backend replaces the mock one area at a time:
//
// - auth: Supabase when this build has a project (Phase 1b), else the demo.
// - everything else: the in-browser mock, for now.

// With real sign-in, the mock only knows who is signed in from Supabase's checked session.
if (SUPABASE_CONFIGURED) mockSession.fromAuthOnly();

export const api: SarrifApi = {
  ...mockApi,
  auth: SUPABASE_CONFIGURED ? supabaseAuth(mockSession) : mockApi.auth,
};

/** True when sign-in is the in-browser demo (no Supabase project set): no emails, no Google. */
export const IS_DEMO_AUTH = !SUPABASE_CONFIGURED;

export { CASHIER_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from './mock/seed';
