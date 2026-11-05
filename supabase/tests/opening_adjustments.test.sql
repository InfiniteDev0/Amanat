-- Phase 2c: opening amounts change only as a recorded adjustment.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@example.com',
   '{"first_name": "Amina", "phone": "+254712345678", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bashir@example.com',
   '{"first_name": "Bashir", "phone": "+254711111111", "language": "so", "terms_version": "2026-10-20"}');

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select complete_onboarding('{
  "profile": {"first_name": "Amina", "phone": "+254712345678", "language": "en"},
  "shop": {"name": "Eastleigh", "location": "", "base_currency": "USD", "currencies": ["USD", "KES"], "time_zone": "Africa/Nairobi"},
  "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 0}],
  "rates": []
}');
insert into ids select 'cash', id from accounts;

select is(set_opening_amount((select id from ids), 1000000), 1000000::bigint, 'Amina sets her Cash USD to 10,000.00');

select results_eq(
  $$ select opening_amount from accounts $$,
  $$ values (1000000::bigint) $$,
  'the account holds it'
);

select results_eq(
  $$ select before_amount, after_amount, changed_by from opening_adjustments $$,
  $$ values (0::bigint, 1000000::bigint, '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'and the change is recorded: from 0 to 10,000.00, by her'
);

select lives_ok($$ select set_opening_amount((select id from ids), 1000000) $$, 'the same amount again');
select is((select count(*)::int from opening_adjustments), 1, 'changes nothing and records nothing');

select throws_ok(
  $$ delete from opening_adjustments $$,
  '42501', null,
  'nobody can erase the record'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select throws_ok(
  $$ select set_opening_amount((select id from ids), 1) $$,
  '42501', null,
  'Bashir can''t change Amina''s account'
);

select is_empty($$ select 1 from opening_adjustments $$, 'nor see its record');

select * from finish();
rollback;
