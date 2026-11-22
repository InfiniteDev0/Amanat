-- The activity log: who did what, when. Written only by the triggers below,
-- so it can't be skipped or faked from the app; nobody changes or deletes a
-- line (append-only). A shop's lines outlive the shop: they keep its id and
-- name, with no link to the shops table, so "Shop deleted" stays in the log.
-- Shops added or deleted and today's rate are the whole business's: they show
-- in every shop's log. Read through activity_of(shop, day).

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.workspaces (id) on delete cascade,
  -- The shop it happened in (null: the whole business, as a rate), kept after the shop is gone.
  shop_id uuid,
  shop_name text,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('create', 'edit', 'delete', 'restore', 'close', 'reopen', 'return', 'set_rates', 'invite', 'change_role', 'remove_member', 'update_shop')),
  -- exchange, amanat, shop, workspace (a shop's settings), rates, invitation…
  record_type text not null,
  record_id uuid,
  before jsonb,
  after jsonb,
  -- The amount involved (minor units), when there is one.
  amount bigint,
  currency text,
  -- A name to go with it: the customer, the shop, the phone invited.
  detail text,
  reason text,
  created_at timestamptz not null default now()
);

create index activity_business_created on public.activity (business_id, created_at desc);
create index activity_shop_created on public.activity (shop_id, created_at desc);

alter table public.activity enable row level security;

create policy "activity: the owner reads"
  on public.activity for select to authenticated
  using (exists (select 1 from public.workspaces w where w.id = business_id and w.owner_id = (select auth.uid())));

revoke all on public.activity from anon, authenticated;
grant select on public.activity to authenticated;

-- One line. Nothing when the business is already gone (a cascade from
-- deleting it), so the log never stops a delete.
create function public.log_activity(
  business uuid, shop uuid, action text, record_type text, record_id uuid,
  amount bigint default null, currency text default null, detail text default null,
  before jsonb default null, after jsonb default null, at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_of_shop text;
begin
  if business is null or not exists (select 1 from public.workspaces where id = business) then
    return;
  end if;
  if shop is not null then
    select s.name into name_of_shop from public.shops s where s.id = shop;
  end if;
  insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, amount, currency, detail, before, after, created_at)
  values (business, shop, name_of_shop, auth.uid(), action, record_type, record_id, amount, currency, detail, before, after, at);
end;
$$;

revoke execute on function public.log_activity(uuid, uuid, text, text, uuid, bigint, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;

-- The business a shop is in; null once it's gone.
create function public.business_of(shop uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.shops where id = shop;
$$;

revoke execute on function public.business_of(uuid) from public, anon, authenticated;

-- ── Shops: added, deleted, changed ───────────────────────────────────────────

create function public.shops_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(new.workspace_id, new.id, 'create', 'shop', new.id, detail => new.name);
  elsif tg_op = 'DELETE' then
    -- The shop is gone by now: its name goes in by hand.
    if exists (select 1 from public.workspaces where id = old.workspace_id) then
      insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, detail, before)
      values (old.workspace_id, old.id, old.name, auth.uid(), 'delete', 'shop', old.id, old.name, jsonb_build_object('name', old.name, 'location', old.location));
    end if;
  elsif (new.name, new.location, new.is_main, new.closing_time, new.large_row_limit) is distinct from (old.name, old.location, old.is_main, old.closing_time, old.large_row_limit) then
    perform public.log_activity(new.workspace_id, new.id, 'update_shop', 'workspace', new.id, detail => new.name,
      before => jsonb_build_object('name', old.name, 'location', old.location, 'is_main', old.is_main),
      after => jsonb_build_object('name', new.name, 'location', new.location, 'is_main', new.is_main));
  end if;
  return null;
end;
$$;

create trigger shops_log after insert or update or delete on public.shops
  for each row execute function public.shops_log();

-- ── Exchanges: recorded, deleted, brought back ───────────────────────────────

create function public.exchanges_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_json jsonb;
begin
  if tg_op = 'INSERT' then
    record_json := jsonb_build_object('currencyIn', new.currency_in, 'currencyOut', new.currency_out, 'amountIn', new.amount_in, 'amountOut', new.amount_out, 'rate', new.customer_rate);
    perform public.log_activity(public.business_of(new.shop_id), new.shop_id, 'create', 'exchange', new.id, new.amount_in, new.currency_in, new.customer, after => record_json, at => new.created_at);
  elsif tg_op = 'UPDATE' and (old.deleted_at is null) <> (new.deleted_at is null) then
    record_json := jsonb_build_object('currencyIn', new.currency_in, 'currencyOut', new.currency_out, 'amountIn', new.amount_in, 'amountOut', new.amount_out, 'rate', new.customer_rate);
    perform public.log_activity(public.business_of(new.shop_id), new.shop_id, case when new.deleted_at is null then 'restore' else 'delete' end, 'exchange', new.id, new.amount_in, new.currency_in, new.customer, before => record_json);
  end if;
  return null;
end;
$$;

create trigger exchanges_log after insert or update on public.exchanges
  for each row execute function public.exchanges_log();

-- ── Amanat: held, given back (and undone), changed, to Trash and back, gone ──

create function public.amanat_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  business uuid;
begin
  if tg_op = 'DELETE' then
    -- Gone with its shop or account (a cascade, a trigger deeper): the shop's own line says so.
    if pg_trigger_depth() > 1 then
      return null;
    end if;
    business := public.business_of(old.shop_id);
    if business is not null then
      perform public.log_activity(business, old.shop_id, 'delete', 'amanat', old.id, old.amount, old.currency, old.client_name, before => jsonb_build_object('forever', true));
    end if;
    return null;
  end if;

  business := public.business_of(new.shop_id);
  if tg_op = 'INSERT' then
    perform public.log_activity(business, new.shop_id, 'create', 'amanat', new.id, new.amount, new.currency, new.client_name, at => new.created_at);
  elsif old.returned_at is null and new.returned_at is not null then
    perform public.log_activity(business, new.shop_id, 'create', 'amanat', new.id, new.amount, new.currency, new.client_name, after => jsonb_build_object('type', 'withdrawal'));
  elsif old.returned_at is not null and new.returned_at is null then
    perform public.log_activity(business, new.shop_id, 'delete', 'amanat', new.id, new.amount, new.currency, new.client_name, before => jsonb_build_object('type', 'withdrawal'));
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform public.log_activity(business, new.shop_id, 'delete', 'amanat', new.id, new.amount, new.currency, new.client_name);
  elsif old.deleted_at is not null and new.deleted_at is null then
    perform public.log_activity(business, new.shop_id, 'restore', 'amanat', new.id, new.amount, new.currency, new.client_name);
  elsif (new.client_name, new.amount, new.account_id, new.note) is distinct from (old.client_name, old.amount, old.account_id, old.note) then
    perform public.log_activity(business, new.shop_id, 'edit', 'amanat', new.id, new.amount, new.currency, new.client_name,
      before => jsonb_build_object('client', old.client_name, 'amount', old.amount, 'note', old.note),
      after => jsonb_build_object('client', new.client_name, 'amount', new.amount, 'note', new.note));
  end if;
  return null;
end;
$$;

create trigger amanat_log after insert or update or delete on public.amanat
  for each row execute function public.amanat_log();

-- ── Today's rate (the whole business's) ──────────────────────────────────────

create function public.rates_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.units_per_usd = old.units_per_usd then
    return null;
  end if;
  perform public.log_activity(new.workspace_id, null, 'set_rates', 'rates', new.id,
    detail => '1 USD = ' || trim(trailing '.' from trim(trailing '0' from new.units_per_usd::text)) || ' ' || new.currency,
    before => case when tg_op = 'UPDATE' then jsonb_build_object('rate', old.units_per_usd) end,
    after => jsonb_build_object('rate', new.units_per_usd, 'currency', new.currency));
  return null;
end;
$$;

create trigger rates_log after insert or update on public.rates
  for each row execute function public.rates_log();

-- ── Invitations: sent, cancelled ─────────────────────────────────────────────

create function public.invitations_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(public.business_of(new.shop_id), new.shop_id, 'invite', 'invitation', new.id, detail => new.phone, after => jsonb_build_object('role', new.role));
  elsif old.status = 'pending' and new.status = 'cancelled' then
    perform public.log_activity(public.business_of(new.shop_id), new.shop_id, 'delete', 'invitation', new.id, detail => new.phone);
  end if;
  return null;
end;
$$;

create trigger invitations_log after insert or update on public.invitations
  for each row execute function public.invitations_log();

revoke execute on function public.shops_log() from public, anon, authenticated;
revoke execute on function public.exchanges_log() from public, anon, authenticated;
revoke execute on function public.amanat_log() from public, anon, authenticated;
revoke execute on function public.rates_log() from public, anon, authenticated;
revoke execute on function public.invitations_log() from public, anon, authenticated;

-- ── Reading: one shop's day, with the business's own lines ───────────────────
-- The day is the business's (its time zone). Newest first, with who did it.

create function public.activity_of(shop uuid, day date)
returns table (
  id uuid, shop_id uuid, shop_name text, user_id uuid, user_name text, action text, record_type text, record_id uuid,
  before jsonb, after jsonb, amount bigint, currency text, detail text, reason text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  business uuid;
  zone text;
begin
  select w.id, w.time_zone into business, zone
  from public.shops s join public.workspaces w on w.id = s.workspace_id
  where s.id = activity_of.shop and w.owner_id = auth.uid();
  if business is null then
    raise exception 'no such shop' using errcode = '42501';
  end if;
  return query
    select a.id, a.shop_id, a.shop_name, a.user_id, coalesce(nullif(btrim(p.first_name), ''), 'Someone'), a.action, a.record_type, a.record_id,
           a.before, a.after, a.amount, a.currency, a.detail, a.reason, a.created_at
    from public.activity a
    left join public.profiles p on p.id = a.user_id
    where a.business_id = business
      and (a.shop_id = activity_of.shop or a.shop_id is null or a.record_type = 'shop')
      and (a.created_at at time zone zone)::date = activity_of.day
    order by a.created_at desc;
end;
$$;

revoke execute on function public.activity_of(uuid, date) from public, anon;
grant execute on function public.activity_of(uuid, date) to authenticated;

-- ── What happened before the log existed, as well as it can be told ─────────
-- Shops, exchanges and amanat still here, and the rates; who did it where it's known.

insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, detail, created_at)
select s.workspace_id, s.id, s.name, w.owner_id, 'create', 'shop', s.id, s.name, s.created_at
from public.shops s join public.workspaces w on w.id = s.workspace_id;

insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, amount, currency, detail, after, created_at)
select s.workspace_id, x.shop_id, s.name, x.created_by, 'create', 'exchange', x.id, x.amount_in, x.currency_in, x.customer,
       jsonb_build_object('currencyIn', x.currency_in, 'currencyOut', x.currency_out, 'amountIn', x.amount_in, 'amountOut', x.amount_out, 'rate', x.customer_rate), x.created_at
from public.exchanges x join public.shops s on s.id = x.shop_id;

insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, before, created_at)
select s.workspace_id, x.shop_id, s.name, x.created_by, 'delete', 'exchange', x.id,
       jsonb_build_object('currencyIn', x.currency_in, 'currencyOut', x.currency_out), x.deleted_at
from public.exchanges x join public.shops s on s.id = x.shop_id
where x.deleted_at is not null;

insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, amount, currency, detail, created_at)
select s.workspace_id, m.shop_id, s.name, m.created_by, 'create', 'amanat', m.id, m.amount, m.currency, m.client_name, m.created_at
from public.amanat m join public.shops s on s.id = m.shop_id;

insert into public.activity (business_id, shop_id, shop_name, user_id, action, record_type, record_id, amount, currency, detail, after, created_at)
select s.workspace_id, m.shop_id, s.name, m.returned_by, 'create', 'amanat', m.id, m.amount, m.currency, m.client_name, jsonb_build_object('type', 'withdrawal'), m.returned_at
from public.amanat m join public.shops s on s.id = m.shop_id
where m.returned_at is not null;

insert into public.activity (business_id, user_id, action, record_type, record_id, detail, after, created_at)
select r.workspace_id, r.set_by, 'set_rates', 'rates', r.id,
       '1 USD = ' || trim(trailing '.' from trim(trailing '0' from r.units_per_usd::text)) || ' ' || r.currency,
       jsonb_build_object('rate', r.units_per_usd, 'currency', r.currency), r.updated_at
from public.rates r;
