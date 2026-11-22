-- Exchanges: dollars bought and sold at our rate, against today's; the owner's only.
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

select lives_ok(
  $$ insert into ids select 'bought', record_exchange('bought', 100000, 127, (select id from ids where name = 'usd'), (select id from ids where name = 'kes')) $$,
  'Amina buys 1,000 $ at 127'
);

select results_eq(
  $$ select currency_in, amount_in, currency_out, amount_out, customer_rate, today_rate, rate from exchanges where id = (select id from ids where name = 'bought') $$,
  $$ values ('USD', 100000::bigint, 'KES', 12700000::bigint, 127::numeric, 129::numeric, '127') $$,
  'dollars in, 127,000 KSh out, today''s rate 129 kept'
);

select lives_ok(
  $$ insert into ids select 'sold', record_exchange('sold', 50000, 131.5, (select id from ids where name = 'usd'), (select id from ids where name = 'kes'), ' Abdi ', 'school fees') $$,
  'and sells 500 $ at 131.5'
);

select results_eq(
  $$ select currency_in, amount_in, currency_out, amount_out, customer, note from exchanges where id = (select id from ids where name = 'sold') $$,
  $$ values ('KES', 6575000::bigint, 'USD', 50000::bigint, 'Abdi', 'school fees') $$,
  'shillings in, dollars out, the customer trimmed'
);

select throws_ok(
  $$ select record_exchange('bought', 100, 127, (select id from ids where name = 'kes'), (select id from ids where name = 'usd')) $$,
  '22023', null,
  'the dollar account must hold dollars'
);

select throws_ok(
  $$ insert into exchanges (shop_id, date, currency_in, amount_in, account_in, currency_out, amount_out, account_out, rate, customer_rate, today_rate)
     select shop_id, current_date, 'USD', 1, id, 'KES', 1, id, '1', 1, 1 from accounts limit 1 $$,
  '42501', null,
  'no writing to the table straight'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';
select is((select count(*)::int from exchanges), 0, 'Bashir sees none of Amina''s exchanges');

select * from finish();
rollback;
