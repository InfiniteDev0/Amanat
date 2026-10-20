-- Phase 1b: one profile per signed-in person, next to Supabase's auth.users.
--
-- The phone is contact data only (E.164, e.g. +254712345678): nobody signs in
-- with it, and it isn't verified. Google sign-ups arrive without a phone or the
-- terms; the app asks for both ("Complete your profile") before anything else.
--
-- Security: RLS is on. A person can read and update their own row and no
-- other, and only the columns they're allowed to change. Rows are created by
-- the trigger below, never by the app; nobody can delete one (it goes with the
-- auth user).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  language text not null default 'so' check (language in ('en', 'so', 'ar')),
  -- Which Terms and Risk statements they agreed to (docs/legal), and when.
  terms_version text check (char_length(terms_version) <= 20),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read your own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: update your own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Supabase grants everything on new tables to anon and authenticated; take it
-- back and give only what the app needs. terms_accepted_at, created_at and
-- updated_at are set by the database, never by the person.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, phone, language, terms_version) on public.profiles to authenticated;

-- Stamps updated_at, and terms_accepted_at whenever the terms version changes,
-- so the time of agreement always comes from the server's clock.
create function public.profiles_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.terms_version is distinct from old.terms_version then
    new.terms_accepted_at := case when new.terms_version is null then null else now() end;
  end if;
  return new;
end;
$$;

create trigger profiles_stamp
  before update on public.profiles
  for each row execute function public.profiles_stamp();

-- A new auth user gets their profile from what the sign-up sent (metadata):
-- first_name, phone, language and terms_version from the Sign up form; from
-- Google, the given name. A phone that isn't valid E.164 is dropped rather
-- than failing the sign-up (the app asks for it again).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_phone text := nullif(btrim(meta ->> 'phone'), '');
  new_terms text := nullif(btrim(meta ->> 'terms_version'), '');
  new_language text := meta ->> 'language';
begin
  insert into public.profiles (id, first_name, phone, language, terms_version, terms_accepted_at)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(meta ->> 'first_name'), ''),
        nullif(btrim(meta ->> 'given_name'), ''),
        split_part(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ' ', 1)
      ),
      80
    ),
    case when new_phone ~ '^\+[1-9][0-9]{7,14}$' then new_phone end,
    case when new_language in ('en', 'so', 'ar') then new_language else 'so' end,
    left(new_terms, 20),
    case when new_terms is not null then now() end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_stamp() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
