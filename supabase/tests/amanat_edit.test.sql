-- Amanat changed: name, note, account and amount while held; once given back, only name and note.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

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
  "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 0}, {"name": "Cash KES", "type": "cash", "currency": "KES", "opening_amount": 0}],
  "rates": [{"currency": "KES", "units_per_usd": "129"}]
}');
insert into ids select 'usd', id from accounts where currency = 'USD';
insert into ids select 'kes', id from accounts where currency = 'KES';
insert into ids select 'held', hold_amanat((select id from ids where name = 'usd'), 'Abdi', 1000000);

select lives_ok(
  $$ select update_amanat((select id from ids where name = 'held'), (select id from ids where name = 'kes'), ' Abdi Hassan ', 129000000, 'moved to shillings') $$,
  'while held: name, account, amount and note change'
);

select results_eq(
  $$ select client_name, account_id, currency, amount, note from amanat $$,
  $$ select 'Abdi Hassan', (select id from ids where name = 'kes'), 'KES', 129000000::bigint, 'moved to shillings' $$,
  'the currency follows the account'
);

select throws_ok(
  $$ select update_amanat((select id from ids where name = 'held'), (select id from ids where name = 'kes'), 'A', 1) $$,
  '22023', null,
  'a name is still needed'
);

select return_amanat((select id from ids where name = 'held'));

select throws_ok(
  $$ select update_amanat((select id from ids where name = 'held'), (select id from ids where name = 'kes'), 'Abdi Hassan', 5) $$,
  '22023', null,
  'given back: the amount stays'
);

select lives_ok(
  $$ select update_amanat((select id from ids where name = 'held'), (select id from ids where name = 'kes'), 'Abdi H.', 129000000, 'paid in full') $$,
  'given back: the name and note still change'
);

select is((select client_name from amanat), 'Abdi H.', 'the new name is kept');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select throws_ok(
  $$ select update_amanat((select id from ids where name = 'held'), (select id from ids where name = 'kes'), 'Bashir', 1) $$,
  '42501', null,
  'Bashir can''t change Amina''s'
);

select * from finish();
rollback;
