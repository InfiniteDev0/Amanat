-- Phase 1b: profiles. Run with `pnpm exec supabase test db` (also in CI).
-- Everything happens in one transaction that is rolled back at the end.

begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

-- Two people: Amina signed up with the form, Bashir with Google.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'amina@example.com',
   '{"first_name": "Amina", "phone": "+254712345678", "language": "en", "terms_version": "2026-10-20"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bashir@example.com',
   '{"given_name": "Bashir", "full_name": "Bashir Ali", "email": "bashir@example.com"}'),
  ('00000000-0000-0000-0000-0000000000c3', 'chaltu@example.com',
   '{"first_name": "Chaltu", "phone": "0712 345 678", "language": "xx"}');

-- ── The trigger ──────────────────────────────────────────────────────────────

select results_eq(
  $$ select first_name, phone, language, terms_version, terms_accepted_at is not null
     from profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  $$ values ('Amina', '+254712345678', 'en', '2026-10-20', true) $$,
  'a form sign-up gets its profile from the metadata, terms stamped'
);

select results_eq(
  $$ select first_name, phone, language, terms_version, terms_accepted_at
     from profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  $$ values ('Bashir', null::text, 'so', null::text, null::timestamptz) $$,
  'a Google sign-up gets the given name, no phone and no terms yet'
);

select results_eq(
  $$ select phone, language from profiles where id = '00000000-0000-0000-0000-0000000000c3' $$,
  $$ values (null::text, 'so') $$,
  'a phone that is not E.164 and an unknown language are dropped, not fatal'
);

-- ── As Amina ─────────────────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$ select id from profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'Amina sees only her own profile'
);

select is_empty(
  $$ select 1 from profiles where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'Amina cannot read Bashir''s profile, even by id'
);

select is_empty(
  $$ update profiles set first_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000b2' returning 1 $$,
  'Amina cannot change Bashir''s profile'
);

select lives_ok(
  $$ update profiles set first_name = 'Amina M', phone = '+254700000001' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'Amina can change her own name and phone'
);

select throws_ok(
  $$ update profiles set phone = '0712345678' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'a phone that is not E.164 is refused'
);

select throws_ok(
  $$ update profiles set terms_accepted_at = now() - interval '1 year' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'nobody can set when they accepted the terms'
);

select throws_ok(
  $$ insert into profiles (id, first_name) values (gen_random_uuid(), 'Ghost') $$,
  '42501', null,
  'nobody can create a profile by hand'
);

select throws_ok(
  $$ delete from profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'nobody can delete a profile'
);

-- ── As Bashir (Google): completing the profile ───────────────────────────────

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select lives_ok(
  $$ update profiles set phone = '+254711111111', terms_version = '2026-10-20' where id = '00000000-0000-0000-0000-0000000000b2' $$,
  'Bashir adds his phone and agrees to the terms'
);

select isnt_empty(
  $$ select 1 from profiles where id = '00000000-0000-0000-0000-0000000000b2' and terms_accepted_at is not null $$,
  'agreeing stamps terms_accepted_at with the server''s time'
);

select is_empty(
  $$ select 1 from profiles where id = '00000000-0000-0000-0000-0000000000a1' $$,
  'Bashir cannot read Amina''s profile'
);

-- ── Signed out ───────────────────────────────────────────────────────────────

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select * from profiles $$,
  '42501', null,
  'a signed-out visitor cannot read profiles at all'
);

select throws_ok(
  $$ update profiles set first_name = 'Hacked' $$,
  '42501', null,
  'a signed-out visitor cannot change profiles'
);

reset role;

select is(
  (select count(*)::int from profiles where first_name = 'Hacked'),
  0,
  'nothing was changed by anyone it did not belong to'
);

select * from finish();
rollback;
