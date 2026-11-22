-- Exchanges: dollars for shillings or shillings for dollars, at the shop's own
-- rate. Each row is what came in and what went out (amount, currency,
-- account), the rate it was done at, and today's rate when it was saved, so
-- its profit (today's rate against ours) never changes with a later rate.
-- Written only through record_exchange; the owner's only.

create table public.exchanges (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  date date not null,
  currency_in text not null check (currency_in ~ '^[A-Z]{3}$'),
  amount_in bigint not null check (amount_in > 0),
  account_in uuid not null references public.accounts (id) on delete cascade,
  currency_out text not null check (currency_out ~ '^[A-Z]{3}$'),
  amount_out bigint not null check (amount_out > 0),
  account_out uuid not null references public.accounts (id) on delete cascade,
  -- amount out per 1 in, as the app keeps it.
  rate text not null,
  -- KSh for 1 $: the customer's (ours), and today's when it was saved.
  customer_rate numeric(20, 6) not null check (customer_rate > 0),
  today_rate numeric(20, 6) not null check (today_rate > 0),
  customer text check (char_length(customer) <= 80),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index exchanges_shop_date on public.exchanges (shop_id, date);

alter table public.exchanges enable row level security;

create policy "exchanges: the owner reads"
  on public.exchanges for select to authenticated
  using (exists (
    select 1 from public.shops s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = shop_id and w.owner_id = (select auth.uid())
  ));

revoke all on public.exchanges from anon, authenticated;
grant select on public.exchanges to authenticated;

-- Records an exchange. side 'bought': the shop takes `amount` dollars and pays
-- shillings at `rate`; 'sold': it pays the dollars and takes the shillings.
-- Both accounts are the owner's, in one shop, in dollars and shillings. Today's
-- rate is the shop's own for today (none set: refused). Returns its id.
create function public.record_exchange(side text, amount bigint, rate numeric, usd_account uuid, kes_account uuid, customer text default null, note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  usd record;
  kes record;
  today date;
  today_rate numeric;
  shillings bigint;
  new_id uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select a.id, a.shop_id, a.currency, a.archived, w.id as workspace_id, w.time_zone into usd
  from public.accounts a
  join public.shops s on s.id = a.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where a.id = record_exchange.usd_account and w.owner_id = me;
  if not found then
    raise exception 'no such account' using errcode = '42501';
  end if;
  select a.id, a.shop_id, a.currency, a.archived into kes
  from public.accounts a
  where a.id = record_exchange.kes_account and a.shop_id = usd.shop_id;
  if not found then
    raise exception 'the accounts aren''t in one shop' using errcode = '22023';
  end if;
  if usd.currency <> 'USD' or kes.currency <> 'KES' or usd.archived or kes.archived then
    raise exception 'a dollar account and a shilling account are needed' using errcode = '22023';
  end if;
  if record_exchange.side not in ('bought', 'sold') then
    raise exception 'bought or sold' using errcode = '22023';
  end if;
  if record_exchange.amount is null or record_exchange.amount <= 0 or record_exchange.rate is null or record_exchange.rate <= 0 then
    raise exception 'an amount and a rate are needed' using errcode = '22023';
  end if;

  today := (now() at time zone usd.time_zone)::date;
  select r.units_per_usd into today_rate
  from public.rates r
  where r.workspace_id = usd.workspace_id and r.date = today and r.currency = 'KES';
  if not found then
    raise exception 'no rate set for today' using errcode = '22023';
  end if;

  -- Minor units both sides: cents of a dollar to cents of a shilling at the rate.
  shillings := round(record_exchange.amount * record_exchange.rate);

  if record_exchange.side = 'bought' then
    insert into public.exchanges (shop_id, date, currency_in, amount_in, account_in, currency_out, amount_out, account_out, rate, customer_rate, today_rate, customer, note, created_by)
    values (usd.shop_id, today, 'USD', record_exchange.amount, usd.id, 'KES', shillings, kes.id,
            trim(trailing '.' from trim(trailing '0' from round(shillings::numeric / record_exchange.amount, 10)::text)),
            record_exchange.rate, today_rate, nullif(btrim(record_exchange.customer), ''), nullif(btrim(record_exchange.note), ''), me)
    returning id into new_id;
  else
    insert into public.exchanges (shop_id, date, currency_in, amount_in, account_in, currency_out, amount_out, account_out, rate, customer_rate, today_rate, customer, note, created_by)
    values (usd.shop_id, today, 'KES', shillings, kes.id, 'USD', record_exchange.amount, usd.id,
            trim(trailing '.' from trim(trailing '0' from round(record_exchange.amount::numeric / shillings, 10)::text)),
            record_exchange.rate, today_rate, nullif(btrim(record_exchange.customer), ''), nullif(btrim(record_exchange.note), ''), me)
    returning id into new_id;
  end if;
  return new_id;
end;
$$;

revoke execute on function public.record_exchange(text, bigint, numeric, uuid, uuid, text, text) from public, anon;
grant execute on function public.record_exchange(text, bigint, numeric, uuid, uuid, text, text) to authenticated;
