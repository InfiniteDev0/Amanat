-- Amanat highlighted, in Trash, restored, deleted for good; the owner's only.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

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
insert into ids select 'held', hold_amanat((select id from accounts), 'Abdi Hassan', 1000000);

select lives_ok($$ select highlight_amanat((select id from ids), true) $$, 'highlighted');
select is((select highlighted from amanat), true, 'it stands out');

select lives_ok($$ select trash_amanat((select id from ids)) $$, 'to Trash');
select isnt((select deleted_at from amanat), null, 'it''s in Trash');
select throws_ok($$ select trash_amanat((select id from ids)) $$, '22023', null, 'not twice');

select throws_ok($$ select owned_amanat((select id from ids)) $$, '42501', null, 'the helper isn''t callable from the app');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select throws_ok($$ select restore_amanat((select id from ids)) $$, '42501', null, 'Bashir can''t restore Amina''s');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok($$ select restore_amanat((select id from ids)) $$, 'back from Trash');
select throws_ok($$ select delete_amanat((select id from ids)) $$, '22023', null, 'deleted for good only from Trash');

select trash_amanat((select id from ids));
select delete_amanat((select id from ids));
select is((select count(*)::int from amanat), 0, 'deleted for good');

select * from finish();
rollback;
