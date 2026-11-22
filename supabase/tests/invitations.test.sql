-- Invitations: by phone, with a right; one waiting per phone per shop; cancelled; the owner's only.
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
insert into ids select 'shop', id from shops;

select lives_ok(
  $$ insert into ids select 'inv', invite_to_shop((select id from ids where name = 'shop'), '+254722000111', 'editor') $$,
  'Amina invites a cashier as an Editor'
);
select results_eq(
  $$ select phone, role, status, invited_by from invitations $$,
  $$ values ('+254722000111', 'editor', 'pending', '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'waiting, by her'
);
select throws_ok(
  $$ select invite_to_shop((select id from ids where name = 'shop'), '+254722000111', 'viewer') $$,
  '23505', null,
  'the same phone twice: refused'
);
select throws_ok(
  $$ select invite_to_shop((select id from ids where name = 'shop'), '+254712345678', 'editor') $$,
  '22023', null,
  'not herself'
);
select throws_ok(
  $$ select invite_to_shop((select id from ids where name = 'shop'), '0722', 'editor') $$,
  null, null,
  'a phone in full, with its country code'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select throws_ok(
  $$ select invite_to_shop((select id from ids where name = 'shop'), '+254733000222', 'owner') $$,
  '42501', null,
  'Bashir can''t invite into Amina''s shop'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ select cancel_invitation((select id from ids where name = 'inv')) $$, 'cancelled');
select is((select status from invitations), 'cancelled', 'no longer waiting');

select * from finish();
rollback;
