-- Phase 2a: several shops, one main. Run with `pnpm exec supabase test db` (also in CI).
-- Everything happens in one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@example.com',
   '{"first_name": "Amina", "phone": "+254712345678", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bashir@example.com',
   '{"first_name": "Bashir", "phone": "+254711111111", "language": "so", "terms_version": "2026-10-20"}');

create temporary table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- ── Amina: her main shop, then a second one ─────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

insert into ids select 'eastleigh', complete_onboarding('{
  "profile": {"first_name": "Amina", "phone": "+254712345678", "language": "en"},
  "shop": {"name": "Eastleigh", "location": "", "base_currency": "USD", "currencies": ["USD", "KES"], "time_zone": "Africa/Nairobi"},
  "accounts": [{"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 100}],
  "rates": []
}');

select lives_ok(
  $$ insert into ids select 'garissa', create_shop('{
       "name": "Garissa", "location": "Garissa town",
       "accounts": [
         {"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 1200000},
         {"name": "M-Pesa", "type": "mobile_money", "currency": "KES", "provider": "M-Pesa", "opening_amount": 9000000}
       ]}') $$,
  '+ New shop works'
);

select results_eq(
  $$ select name, is_main from shops order by name $$,
  $$ values ('Eastleigh', true), ('Garissa', false) $$,
  'the new shop is an ordinary shop; Eastleigh stays main'
);

select results_eq(
  $$ select a.name, a.opening_amount from accounts a where a.shop_id = (select id from ids where name = 'garissa') order by a.name $$,
  $$ values ('Cash USD', 1200000::bigint), ('M-Pesa', 9000000::bigint) $$,
  'with its own accounts and opening amounts'
);

select throws_ok(
  $$ select create_shop('{"name": "Mandera", "accounts": [
       {"name": "Cash USD", "type": "cash", "currency": "USD", "opening_amount": 1},
       {"name": "Cash ETB", "type": "cash", "currency": "ETB", "opening_amount": 1}]}') $$,
  '22023', null,
  'a new shop that fails half way (a currency the business doesn''t trade) fails as a whole'
);

select is_empty($$ select 1 from shops where name = 'Mandera' $$, 'and leaves nothing behind');

select throws_ok(
  $$ select create_shop('{"name": "Wajir", "accounts": []}') $$,
  '22023', null,
  'a shop needs at least one account'
);

-- ── One main per business ────────────────────────────────────────────────────

select lives_ok(
  $$ select set_main_shop((select id from ids where name = 'garissa')) $$,
  'Set as main works'
);

select results_eq(
  $$ select name, is_main from shops order by name $$,
  $$ values ('Eastleigh', false), ('Garissa', true) $$,
  'the star moves: Garissa is main, Eastleigh isn''t'
);

select throws_ok(
  $$ select delete_shop((select id from ids where name = 'garissa')) $$,
  'P0001', null,
  'the main shop can''t be deleted'
);

select throws_ok(
  $$ delete from shops $$,
  '42501', null,
  'nor can any shop be deleted directly'
);

select lives_ok(
  $$ select delete_shop((select id from ids where name = 'eastleigh')) $$,
  'an ordinary shop can be deleted'
);

select is_empty(
  $$ select 1 from accounts where shop_id = (select id from ids where name = 'eastleigh') $$,
  'and its accounts go with it'
);

reset role;

select throws_ok(
  $$ insert into shops (workspace_id, name, is_main) select workspace_id, 'Second main', true from shops where name = 'Garissa' $$,
  '23505', null,
  'the database itself refuses a second main shop in one business'
);

-- ── Bashir and Amina's shop ──────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select is_empty(
  $$ select 1 from shops where id = (select id from ids where name = 'garissa') $$,
  'Bashir can''t see Amina''s shop, even by id (no access)'
);

select throws_ok(
  $$ select set_main_shop((select id from ids where name = 'garissa')) $$,
  '42501', null,
  'nor make it main'
);

select throws_ok(
  $$ select delete_shop((select id from ids where name = 'garissa')) $$,
  '42501', null,
  'nor delete it'
);

select * from finish();
rollback;
