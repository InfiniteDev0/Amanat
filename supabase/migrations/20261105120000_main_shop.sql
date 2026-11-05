-- Phase 1d: the first real shop. Onboarding saves the owner's business, its
-- main shop, the shop's accounts with their opening amounts, and today's
-- rates, all in one transaction (complete_onboarding below).
--
-- One owner only for now: every row belongs to whoever owns the workspace,
-- and only they can see it (RLS: owner_id = auth.uid()). Inviting a team,
-- roles per shop and membership checks come in 1e.
--
-- Money is a whole number of minor units (bigint: 129.50 is 12950), the same
-- as the app (packages/core/src/money.ts). Rates are the market's direction,
-- units of the currency per 1 US dollar (packages/core/src/quotes.ts): the
-- base currency is only for totals, never for how a rate is typed or stored.

-- ── Onboarding progress on the profile ───────────────────────────────────────
-- Saved after every step, so closing the tab or switching device carries on
-- at the same step with the answers kept. Finished = onboarding_completed_at,
-- set only by complete_onboarding, in the same transaction as the shop.

alter table public.profiles
  add column onboarding_step smallint not null default 0 check (onboarding_step between 0 and 20),
  add column onboarding_data jsonb
    check (onboarding_data is null or (jsonb_typeof(onboarding_data) = 'object' and pg_column_size(onboarding_data) <= 65536)),
  add column onboarding_completed_at timestamptz;

grant update (onboarding_step, onboarding_data) on public.profiles to authenticated;

-- ── The business ─────────────────────────────────────────────────────────────

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  -- What totals and profit are counted in.
  base_currency text not null check (base_currency ~ '^[A-Z]{3}$'),
  -- Every currency the business trades; always includes the base.
  currencies text[] not null
    check (cardinality(currencies) between 1 and 30 and base_currency = any (currencies)),
  -- The shop's day (and "today's rates") is counted in this zone.
  time_zone text not null default 'Africa/Nairobi',
  created_at timestamptz not null default now()
);

create index workspaces_owner_id on public.workspaces (owner_id);

-- ── Shops: the main one now, more later ──────────────────────────────────────

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  location text not null default '' check (char_length(location) <= 120),
  -- The owner's central shop: created at onboarding, never deleted.
  is_main boolean not null default false,
  -- When "Day not closed" fires.
  closing_time time not null default '21:00',
  -- Rows above this (base minor units) raise "Large transaction".
  large_row_limit bigint not null default 500000 check (large_row_limit >= 0),
  created_at timestamptz not null default now()
);

create index shops_workspace_id on public.shops (workspace_id);
create unique index shops_one_main on public.shops (workspace_id) where is_main;

-- ── Accounts: where the shop's money sits ────────────────────────────────────
-- The opening amount is the starting line of the books: every balance, drawer
-- check and profit depends on it. It isn't changed afterwards; a correction
-- will be a recorded adjustment (who, when, why), never a quiet edit.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  type text not null check (type in ('cash', 'mobile_money', 'bank')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- M-Pesa, EVC Plus, Zaad, or the bank's name.
  provider text check (char_length(provider) <= 60),
  opening_amount bigint not null default 0 check (opening_amount >= 0),
  -- "Low balance" fires below this; null for no alert.
  minimum_balance bigint check (minimum_balance >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index accounts_shop_id on public.accounts (shop_id);

-- ── Rates: "1 USD = 129 KSh", one per currency per day ──────────────────────

create table public.rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  date date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$' and currency <> 'USD'),
  units_per_usd numeric(20, 6) not null check (units_per_usd > 0),
  set_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, date, currency)
);

-- Who set it and when always come from the server, never from the request.
create function public.rates_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.set_by := coalesce(auth.uid(), new.set_by);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger rates_stamp
  before insert or update on public.rates
  for each row execute function public.rates_stamp();

-- ── Who can see and change what: the owner, and nobody else ─────────────────

alter table public.workspaces enable row level security;
alter table public.shops enable row level security;
alter table public.accounts enable row level security;
alter table public.rates enable row level security;

create policy "workspaces: the owner reads"
  on public.workspaces for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "shops: the owner reads"
  on public.shops for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

create policy "shops: the owner updates"
  on public.shops for update to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

create policy "accounts: the owner reads"
  on public.accounts for select to authenticated
  using (exists (
    select 1 from public.shops s join public.workspaces w on w.id = s.workspace_id
    where s.id = shop_id and w.owner_id = (select auth.uid())
  ));

create policy "rates: the owner reads"
  on public.rates for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));

-- Today's rates only (in the shop's time zone), for a currency the business trades.
create policy "rates: the owner sets today's"
  on public.rates for insert to authenticated
  with check (exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
      and currency = any (w.currencies)
      and date = (now() at time zone w.time_zone)::date
  ));

create policy "rates: the owner changes today's"
  on public.rates for update to authenticated
  using (exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
      and date = (now() at time zone w.time_zone)::date
  ))
  with check (exists (
    select 1 from public.workspaces w
    where w.id = workspace_id and w.owner_id = (select auth.uid())
      and currency = any (w.currencies)
      and date = (now() at time zone w.time_zone)::date
  ));

-- Supabase grants everything on new tables; take it back and give only what
-- the app needs. Workspaces, shops and accounts are created by
-- complete_onboarding, never directly. Opening amounts can't be edited.
revoke all on public.workspaces, public.shops, public.accounts, public.rates from anon, authenticated;
grant select on public.workspaces, public.shops, public.accounts, public.rates to authenticated;
grant update (name, location, closing_time, large_row_limit) on public.shops to authenticated;
grant insert (workspace_id, date, currency, units_per_usd) on public.rates to authenticated;
grant update (units_per_usd) on public.rates to authenticated;

-- ── Open my shop: everything at once, or nothing ────────────────────────────
-- `setup` (built by the server action from the checked OnboardingInput):
--
--   { "profile":  { "first_name", "phone", "language", "terms_version"? },
--     "shop":     { "name", "location", "base_currency", "currencies": [],
--                   "time_zone", "large_row_limit" },
--     "accounts": [ { "name", "type", "currency", "provider"?, "opening_amount" } ],
--     "rates":    [ { "currency", "units_per_usd" } ] }
--
-- Returns the main shop's id. Safe to call twice (a double click, a retry
-- after a lost answer): the second call waits for the first, sees it's done
-- and returns the same shop. Any failure rolls the whole thing back.

create function public.complete_onboarding(setup jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  profile jsonb := setup -> 'profile';
  shop jsonb := setup -> 'shop';
  zone text := shop ->> 'time_zone';
  traded text[];
  finished timestamptz;
  new_workspace uuid;
  new_shop uuid;
  today date;
  account jsonb;
  quote jsonb;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  -- One at a time per person: a second call waits here for the first.
  select onboarding_completed_at into finished from public.profiles where id = me for update;
  if not found then
    raise exception 'no profile' using errcode = 'P0002';
  end if;
  if finished is not null then
    select s.id into new_shop
    from public.shops s join public.workspaces w on w.id = s.workspace_id
    where w.owner_id = me and s.is_main
    order by w.created_at
    limit 1;
    return new_shop;
  end if;

  if zone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = zone) then
    raise exception 'unknown time zone' using errcode = '22023';
  end if;
  today := (now() at time zone zone)::date;
  traded := array(select jsonb_array_elements_text(shop -> 'currencies'));

  -- The profile: name, phone, language, and the terms if they're still owed
  -- (Google sign-ups). The stamp trigger sets terms_accepted_at.
  update public.profiles
  set first_name = btrim(profile ->> 'first_name'),
      phone = profile ->> 'phone',
      language = profile ->> 'language',
      terms_version = coalesce(terms_version, nullif(profile ->> 'terms_version', '')),
      onboarding_completed_at = now(),
      onboarding_data = null
  where id = me;

  if exists (select 1 from public.profiles where id = me and (phone is null or terms_accepted_at is null or first_name = '')) then
    raise exception 'profile incomplete' using errcode = '22023';
  end if;

  insert into public.workspaces (owner_id, name, base_currency, currencies, time_zone)
  values (me, btrim(shop ->> 'name'), shop ->> 'base_currency', traded, zone)
  returning id into new_workspace;

  insert into public.shops (workspace_id, name, location, is_main, large_row_limit)
  values (
    new_workspace,
    btrim(shop ->> 'name'),
    coalesce(btrim(shop ->> 'location'), ''),
    true,
    coalesce((shop ->> 'large_row_limit')::bigint, 500000)
  )
  returning id into new_shop;

  if jsonb_array_length(coalesce(setup -> 'accounts', '[]'::jsonb)) = 0 then
    raise exception 'no accounts' using errcode = '22023';
  end if;
  for account in select * from jsonb_array_elements(setup -> 'accounts') loop
    if not (account ->> 'currency') = any (traded) then
      raise exception 'account currency % is not traded', account ->> 'currency' using errcode = '22023';
    end if;
    insert into public.accounts (shop_id, name, type, currency, provider, opening_amount)
    values (
      new_shop,
      btrim(account ->> 'name'),
      account ->> 'type',
      account ->> 'currency',
      nullif(btrim(account ->> 'provider'), ''),
      (account ->> 'opening_amount')::bigint
    );
  end loop;

  for quote in select * from jsonb_array_elements(coalesce(setup -> 'rates', '[]'::jsonb)) loop
    if not (quote ->> 'currency') = any (traded) or cardinality(traded) < 2 then
      raise exception 'rate currency % is not traded', quote ->> 'currency' using errcode = '22023';
    end if;
    insert into public.rates (workspace_id, date, currency, units_per_usd, set_by)
    values (new_workspace, today, quote ->> 'currency', (quote ->> 'units_per_usd')::numeric, me);
  end loop;

  return new_shop;
end;
$$;

revoke execute on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
revoke execute on function public.rates_stamp() from public, anon, authenticated;
