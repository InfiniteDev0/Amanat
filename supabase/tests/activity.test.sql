-- The activity log: written by the database as things happen, read by the owner.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@example.com',
   '{"first_name": "Amina", "phone": "+254712345678", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bashir@example.com',
   '{"first_name": "Bashir", "phone": "+254711111111", "language": "so", "terms_version": "2026-10-20"}');

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

insert into ids select 'main', complete_onboarding('{
  "profile": {"first_name": "Amina", "phone": "+254712345678", "language": "en"},
  "shop": {"name": "Eastleigh", "location": "", "base_currency": "USD", "currencies": ["USD", "KES"], "time_zone": "Africa/Nairobi"},
  "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 0}, {"name": "Cash KES", "type": "cash", "currency": "KES", "opening_amount": 0}],
  "rates": [{"currency": "KES", "units_per_usd": "129"}]
}');
insert into ids select 'x', record_exchange('bought', 100000, 127, (select id from accounts where currency = 'USD'), (select id from accounts where currency = 'KES'), 'Abdi');
insert into ids select 'garissa', create_shop('{"name": "Garissa", "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 0}]}');
insert into ids select 'm', hold_amanat((select a.id from accounts a where a.shop_id = (select id from ids where name = 'garissa')), 'Faadumo', 5000);
select delete_shop((select id from ids where name = 'garissa'));

select is(
  (select count(*)::int from activity_of((select id from ids where name = 'main'), (now() at time zone 'Africa/Nairobi')::date) where record_type = 'exchange' and action = 'create' and detail = 'Abdi' and user_name = 'Amina'),
  1, 'the exchange is in the log, by Amina'
);
select is(
  (select count(*)::int from activity_of((select id from ids where name = 'main'), (now() at time zone 'Africa/Nairobi')::date) where record_type = 'rates'),
  1, 'the rate set at onboarding too'
);
select is(
  (select count(*)::int from activity_of((select id from ids where name = 'main'), (now() at time zone 'Africa/Nairobi')::date) where record_type = 'shop' and action = 'delete' and shop_name = 'Garissa'),
  1, 'a deleted shop stays in the log, by its name, in the other shops'' logs'
);
select is(
  (select count(*)::int from activity where record_type = 'amanat' and action = 'delete'),
  0, 'its amanat going with it adds no line of its own'
);
select is(
  (select count(*)::int from activity_of((select id from ids where name = 'main'), (now() at time zone 'Africa/Nairobi')::date) where record_type = 'amanat'),
  0, 'Garissa''s amanat isn''t in Eastleigh''s log'
);

select trash_exchanges(array[(select id from ids where name = 'x')]);
select is((select count(*)::int from activity where record_type = 'exchange' and action = 'delete'), 1, 'deleting an exchange is logged');

select throws_ok($$ insert into activity (business_id, action, record_type) values ((select id from workspaces), 'create', 'shop') $$, '42501', null, 'nobody writes the log by hand');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from activity), 0, 'Bashir sees none of Amina''s log');
select throws_ok(
  format('select * from activity_of(%L, current_date)', (select id from ids where name = 'main')),
  '42501', null, 'nor reads it by her shop'
);

select * from finish();
rollback;
