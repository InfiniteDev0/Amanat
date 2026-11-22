-- Exchanges deleted and brought back; the owner's only.
-- Run with `pnpm exec supabase test db` (also in CI). Rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(5);

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
insert into ids select 'x', record_exchange('bought', 100000, 127, (select id from accounts where currency = 'USD'), (select id from accounts where currency = 'KES'));

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is(trash_exchanges(array[(select id from ids)]), 0, 'Bashir can''t delete Amina''s exchange');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select is(trash_exchanges(array[(select id from ids)]), 1, 'Amina deletes hers');
select isnt((select deleted_at from exchanges), null, 'it''s off the lists');
select is(restore_exchanges(array[(select id from ids)]), 1, 'and brings it back');
select is((select deleted_at from exchanges), null, 'it''s back');

select * from finish();
rollback;
