-- Phase 1d: the main shop. Run with `pnpm exec supabase test db` (also in CI).
-- Everything happens in one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

-- Amina signed up with the form (phone and terms given). Bashir and Chaltu too.
-- Dahir came through Google: no phone, no terms yet.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@example.com',
   '{"first_name": "Amina", "phone": "+254712345678", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bashir@example.com',
   '{"first_name": "Bashir", "phone": "+254711111111", "language": "so", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'chaltu@example.com',
   '{"first_name": "Chaltu", "phone": "+251911111111", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'dahir@example.com',
   '{"given_name": "Dahir"}');

-- A setup like the wizard sends: base KSh, but the rate in the market's
-- direction (1 USD = 129 KSh).
create temporary table setup_of (who text primary key, setup jsonb);
grant select on setup_of to authenticated;
insert into setup_of values
  ('amina', '{
     "profile": {"first_name": "Amina", "phone": "+254712345678", "language": "en"},
     "shop": {"name": "Eastleigh", "location": "Nairobi", "base_currency": "KES",
              "currencies": ["KES", "USD"], "time_zone": "Africa/Nairobi", "large_row_limit": 500000},
     "accounts": [
       {"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 2000000},
       {"name": "M-Pesa", "type": "mobile_money", "currency": "KES", "provider": "M-Pesa", "opening_amount": 150000000}
     ],
     "rates": [{"currency": "KES", "units_per_usd": "129"}]
   }'),
  -- Breaks half way: the second account is in a currency the shop doesn't trade.
  ('chaltu-broken', '{
     "profile": {"first_name": "Chaltu", "phone": "+251911111111", "language": "en"},
     "shop": {"name": "Bole", "location": "", "base_currency": "ETB",
              "currencies": ["ETB", "USD"], "time_zone": "Africa/Addis_Ababa"},
     "accounts": [
       {"name": "Cash ETB", "type": "cash", "currency": "ETB", "opening_amount": 100},
       {"name": "Cash EUR", "type": "cash", "currency": "EUR", "opening_amount": 100}
     ],
     "rates": []
   }'),
  -- No phone in the setup, and Dahir has none on his profile either.
  ('dahir-no-phone', '{
     "profile": {"first_name": "Dahir", "language": "so", "terms_version": "2026-10-20"},
     "shop": {"name": "Hodan", "location": "", "base_currency": "USD",
              "currencies": ["USD"], "time_zone": "Africa/Mogadishu"},
     "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 0}],
     "rates": []
   }');

-- What Amina's Open my shop returns, and her workspace's id, for later checks.
create temporary table opened (shop uuid, workspace uuid);
grant all on opened to authenticated;

-- ── Amina opens her shop ─────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok(
  $$ update profiles set onboarding_step = 3, onboarding_data = '{"shopName": "Eastleigh"}'
     where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'progress is saved after a step'
);

select results_eq(
  $$ select onboarding_step, onboarding_data ->> 'shopName' from profiles $$,
  $$ values (3::smallint, 'Eastleigh') $$,
  'and read back: she resumes on step 3 with her answers'
);

select lives_ok(
  $$ insert into opened (shop) select complete_onboarding((select setup from setup_of where who = 'amina')) $$,
  'Open my shop works'
);
update opened set workspace = (select id from workspaces);

select results_eq(
  $$ select name, location, is_main from shops $$,
  $$ values ('Eastleigh', 'Nairobi', true) $$,
  'her main shop exists'
);

select results_eq(
  $$ select name, opening_amount from accounts order by name $$,
  $$ values ('Cash USD', 2000000::bigint), ('M-Pesa', 150000000::bigint) $$,
  'with its accounts and opening amounts in minor units'
);

select results_eq(
  $$ select currency, units_per_usd, set_by from rates $$,
  $$ values ('KES', 129.000000::numeric, '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'the rate is stored as units per USD (1 USD = 129 KSh), though the base is KSh'
);

select results_eq(
  $$ select date from rates $$,
  $$ values ((now() at time zone 'Africa/Nairobi')::date) $$,
  'dated today in the shop''s time zone'
);

select results_eq(
  $$ select onboarding_completed_at is not null, onboarding_data from profiles $$,
  $$ values (true, null::jsonb) $$,
  'setup is marked finished and the draft is cleared'
);

select is(
  complete_onboarding((select setup from setup_of where who = 'amina')),
  (select shop from opened),
  'a second Open my shop (double click) returns the same shop'
);

select is((select count(*)::int from workspaces), 1, 'and creates nothing twice');

select throws_ok(
  $$ insert into workspaces (owner_id, name, base_currency, currencies)
     values ('00000000-0000-0000-0000-0000000000a1', 'Side shop', 'USD', '{USD}') $$,
  '42501', null,
  'shops are only created by Open my shop'
);

select throws_ok(
  $$ update accounts set opening_amount = 1 $$,
  '42501', null,
  'an opening amount cannot be quietly changed'
);

select lives_ok(
  $$ update shops set location = 'Eastleigh, 1st Ave' $$,
  'she can change her shop''s details'
);

select lives_ok(
  $$ update rates set units_per_usd = 129.5 where currency = 'KES' $$,
  'she can change today''s rate'
);

select throws_ok(
  $$ insert into rates (workspace_id, date, currency, units_per_usd)
     select id, current_date - 7, 'KES', 120 from workspaces $$,
  '42501', null,
  'but not set one for another day'
);

select throws_ok(
  $$ insert into rates (workspace_id, date, currency, units_per_usd)
     select id, (now() at time zone 'Africa/Nairobi')::date, 'SOS', 4000 from workspaces $$,
  '42501', null,
  'nor for a currency the shop doesn''t trade'
);

-- ── Bashir sees none of it ───────────────────────────────────────────────────

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select is_empty($$ select 1 from workspaces $$, 'Bashir sees no workspace of Amina''s');
select is_empty($$ select 1 from shops where id = (select shop from opened) $$, 'nor her shop, even by id');
select is_empty($$ select 1 from accounts $$, 'nor her accounts');
select is_empty($$ select 1 from rates $$, 'nor her rates');

select is_empty(
  $$ update shops set name = 'Hacked' where id = (select shop from opened) returning 1 $$,
  'and cannot rename her shop'
);

select throws_ok(
  $$ insert into rates (workspace_id, date, currency, units_per_usd)
     select workspace, (now() at time zone 'Africa/Nairobi')::date, 'KES', 1 from opened $$,
  '42501', null,
  'nor set rates in it, even knowing its id'
);

-- ── All or nothing ───────────────────────────────────────────────────────────

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c3", "role": "authenticated"}';

select throws_ok(
  $$ select complete_onboarding((select setup from setup_of where who = 'chaltu-broken')) $$,
  '22023', null,
  'a failure half way through (an account in a currency not traded) fails the whole save'
);

reset role;

select is(
  (select count(*)::int from workspaces where owner_id = '00000000-0000-0000-0000-0000000000c3')
    + (select count(*)::int from shops where name = 'Bole')
    + (select count(*)::int from accounts where name = 'Cash ETB'),
  0,
  'and nothing of it was kept: no workspace, no shop, no account'
);

select is(
  (select onboarding_completed_at from profiles where id = '00000000-0000-0000-0000-0000000000c3'),
  null,
  'Chaltu is still setting up'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d4", "role": "authenticated"}';

select throws_ok(
  $$ select complete_onboarding((select setup from setup_of where who = 'dahir-no-phone')) $$,
  '22023', null,
  'a Google sign-up cannot finish without a phone'
);

-- ── Signed out ───────────────────────────────────────────────────────────────

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select complete_onboarding('{}') $$,
  '42501', null,
  'a signed-out visitor cannot open a shop'
);

select * from finish();
rollback;
