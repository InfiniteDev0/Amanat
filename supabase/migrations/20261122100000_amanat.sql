-- Amanat: money a customer leaves with the shop. It comes into one of the
-- shop's accounts but is the customer's, not the shop's, until it goes back.
-- One row per amanat: who, how much, into which account, when; and, once
-- given back, when and by whom. Written only through the functions below, so
-- who did it and when always come from the server.

create table public.amanat (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  client_name text not null check (char_length(btrim(client_name)) between 2 and 80),
  -- Minor units, in the account's currency.
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  note text check (char_length(note) <= 200),
  -- The shop's day it was held on.
  date date not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Given back: when, by whom (null while held).
  returned_at timestamptz,
  returned_by uuid references auth.users (id) on delete set null
);

create index amanat_shop_id on public.amanat (shop_id);
create index amanat_account_id on public.amanat (account_id);

alter table public.amanat enable row level security;

create policy "amanat: the owner reads"
  on public.amanat for select to authenticated
  using (exists (
    select 1 from public.shops s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = shop_id and w.owner_id = (select auth.uid())
  ));

revoke all on public.amanat from anon, authenticated;
grant select on public.amanat to authenticated;

-- Holds amanat: the owner's account (not archived), a name, an amount above
-- nothing. The currency is the account's; the day is the shop's today.
-- Someone else's account (or none) is refused the same way. Returns its id.
create function public.hold_amanat(account uuid, client_name text, amount bigint, note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  acc record;
  new_id uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select a.id, a.shop_id, a.currency, a.archived, w.time_zone into acc
  from public.accounts a
  join public.shops s on s.id = a.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where a.id = account and w.owner_id = me;
  if not found then
    raise exception 'no such account' using errcode = '42501';
  end if;
  if acc.archived then
    raise exception 'that account is archived' using errcode = '22023';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'amanat must be more than nothing' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(client_name, ''))) < 2 then
    raise exception 'the customer''s name is needed' using errcode = '22023';
  end if;

  insert into public.amanat (shop_id, account_id, client_name, amount, currency, note, date, created_by)
  values (acc.shop_id, acc.id, btrim(client_name), amount, acc.currency, nullif(btrim(note), ''), (now() at time zone acc.time_zone)::date, me)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.hold_amanat(uuid, text, bigint, text) from public, anon;
grant execute on function public.hold_amanat(uuid, text, bigint, text) to authenticated;

-- Gives it back, now. Already given back: refused.
create function public.return_amanat(amanat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  back timestamptz;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select m.returned_at into back
  from public.amanat m
  join public.shops s on s.id = m.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where m.id = return_amanat.amanat and w.owner_id = me
  for update of m;
  if not found then
    raise exception 'no such amanat' using errcode = '42501';
  end if;
  if back is not null then
    raise exception 'already given back' using errcode = '22023';
  end if;

  update public.amanat set returned_at = now(), returned_by = me where id = return_amanat.amanat;
end;
$$;

revoke execute on function public.return_amanat(uuid) from public, anon;
grant execute on function public.return_amanat(uuid) to authenticated;

-- Undoes "given back", the same shop day only: it's held again.
create function public.undo_return_amanat(amanat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  rec record;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select m.returned_at, w.time_zone into rec
  from public.amanat m
  join public.shops s on s.id = m.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where m.id = undo_return_amanat.amanat and w.owner_id = me
  for update of m;
  if not found then
    raise exception 'no such amanat' using errcode = '42501';
  end if;
  if rec.returned_at is null then
    raise exception 'it hasn''t been given back' using errcode = '22023';
  end if;
  if (rec.returned_at at time zone rec.time_zone)::date <> (now() at time zone rec.time_zone)::date then
    raise exception 'only on the day it was given back' using errcode = '22023';
  end if;

  update public.amanat set returned_at = null, returned_by = null where id = undo_return_amanat.amanat;
end;
$$;

revoke execute on function public.undo_return_amanat(uuid) from public, anon;
grant execute on function public.undo_return_amanat(uuid) to authenticated;
