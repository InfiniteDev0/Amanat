-- Amanat: held, given back, undone; the owner's only.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

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

select lives_ok(
  $$ insert into ids select 'held', hold_amanat((select id from ids where name = 'cash'), '  Abdi Hassan ', 1000000, 'for the wedding') $$,
  'Amina holds 10,000.00 $ for Abdi'
);

select results_eq(
  $$ select client_name, amount, currency, note, created_by, returned_at from amanat $$,
  $$ values ('Abdi Hassan', 1000000::bigint, 'USD', 'for the wedding', '00000000-0000-0000-0000-0000000000a1'::uuid, null::timestamptz) $$,
  'held: the name trimmed, the account''s currency, by her, not given back'
);

select is((select date from amanat), (now() at time zone 'Africa/Nairobi')::date, 'on the shop''s today');

select throws_ok(
  $$ select hold_amanat((select id from ids where name = 'cash'), 'Abdi', 0) $$,
  '22023', null,
  'nothing can''t be held'
);

select throws_ok(
  $$ select hold_amanat((select id from ids where name = 'cash'), 'A', 500) $$,
  '22023', null,
  'a name is needed'
);

select throws_ok(
  $$ insert into amanat (shop_id, account_id, client_name, amount, currency, date) select shop_id, id, 'Sneaky', 1, 'USD', current_date from accounts $$,
  '42501', null,
  'no writing to the table straight'
);

select lives_ok($$ select return_amanat((select id from ids where name = 'held')) $$, 'given back');
select isnt((select returned_at from amanat), null, 'marked given back');

select throws_ok(
  $$ select return_amanat((select id from ids where name = 'held')) $$,
  '22023', null,
  'not twice'
);

select lives_ok($$ select undo_return_amanat((select id from ids where name = 'held')) $$, 'undone, the same day');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select is((select count(*)::int from amanat), 0, 'Bashir sees none of Amina''s amanat');

select throws_ok(
  $$ select hold_amanat((select id from ids where name = 'cash'), 'Bashir', 100) $$,
  '42501', null,
  'and can''t hold any in her account'
);

select * from finish();
rollback;
