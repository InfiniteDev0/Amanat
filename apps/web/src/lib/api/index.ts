import type { SarrifApi } from '@sarrif/core';

import { SUPABASE_CONFIGURED } from '@/lib/supabase/env';

import { mockApi, mockSession } from './mock/mock-api';
import { supabaseActivity } from './supabase/activity';
import { supabaseAmanat } from './supabase/amanat';
import { supabaseAuth } from './supabase/auth';
import { supabaseDeals } from './supabase/deals';
import { notYetAreas } from './supabase/not-yet';
import { supabaseShops } from './supabase/shops';
import { supabaseTeam } from './supabase/team';

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
  // Amanat is in the database too (the local one for now, migration 20261122100000), and the activity log (20261123100000).
  return { ...mockApi, ...notYetAreas(shops), ...supabaseAmanat(auth), ...supabaseDeals(auth, shops), ...supabaseTeam(auth), ...supabaseActivity(), onboarding, workspaces, accounts, rates, summary, auth };
}

export const api: SarrifApi = SUPABASE_CONFIGURED ? realApi() : mockApi;

/** True when sign-in is the in-browser demo (no Supabase project set): no emails, no Google. */
export const IS_DEMO_AUTH = !SUPABASE_CONFIGURED;

/** Whether money can be recorded yet: the demo can; a real shop once the ledger is in the database (Phase 3). */
export const CAN_RECORD = !SUPABASE_CONFIGURED;

/** Amanat can be held, given back and undone everywhere: the demo, and the database (its own table). */
export const CAN_HOLD_AMANAT = true;

/** Exchanges can be saved everywhere: the demo, and the database (migration 20261122130000). */
export const CAN_SAVE_EXCHANGE = true;

/** Whether people can be invited yet: the demo can; a real shop with team roles (1e). */
// Invitations are in the database too (migration 20261122150000); joining from one comes next.
export const CAN_INVITE = true;

export { CASHIER_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from './mock/seed';
