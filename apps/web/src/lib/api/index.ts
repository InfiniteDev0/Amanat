import type { SarrifApi } from '@sarrif/core';

import { SUPABASE_CONFIGURED } from '@/lib/supabase/env';

import { mockApi, mockSession } from './mock/mock-api';
import { supabaseAuth } from './supabase/auth';
import { notYetAreas } from './supabase/not-yet';
import { supabaseShops } from './supabase/shops';

// The one backend the UI talks to. Screens never import the mock, Supabase
// or fetch directly: they use the hooks in features/*/queries.ts, which call
// `api`. The real backend replaces the mock one area at a time. With a
// Supabase project:
//
// - auth: Supabase (Phase 1b).
// - onboarding, shops, accounts, rates, Home's figures: Supabase (1d).
// - money records (deals, expenses, amanat, closings, team…): empty, and
//   "not yet" on save, until their tables exist (never the demo data's).
// - notifications and market rates: the mock, for now.
//
// Without one (the demo sign-in), everything is the in-browser mock.

// With real sign-in, the mock only knows who is signed in from Supabase's checked session.
if (SUPABASE_CONFIGURED) mockSession.fromAuthOnly();

function realApi(): SarrifApi {
  const auth = supabaseAuth(mockSession);
  const shops = supabaseShops(auth);
  const { onboarding, workspaces, accounts, rates, summary } = shops;
  return { ...mockApi, ...notYetAreas(shops), onboarding, workspaces, accounts, rates, summary, auth };
}

export const api: SarrifApi = SUPABASE_CONFIGURED ? realApi() : mockApi;

/** True when sign-in is the in-browser demo (no Supabase project set): no emails, no Google. */
export const IS_DEMO_AUTH = !SUPABASE_CONFIGURED;

/** Whether an owner can add shops beyond the main one yet (the demo can; the database from a later phase). */
export const CAN_ADD_SHOPS = !SUPABASE_CONFIGURED;

export { CASHIER_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from './mock/seed';
