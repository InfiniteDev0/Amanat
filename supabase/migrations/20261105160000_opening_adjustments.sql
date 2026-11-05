-- Phase 2c (first part): changing an account's opening amount. The opening
-- amount is the starting line of the books, so it is never quietly edited:
-- every change goes through set_opening_amount, which writes who changed it,
-- when, from what to what (and why, when given) in the same transaction.
-- The log can't be changed or deleted by anyone.

create table public.opening_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  before_amount bigint not null,
  after_amount bigint not null check (after_amount >= 0),
  reason text check (char_length(reason) <= 200),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index opening_adjustments_account_id on public.opening_adjustments (account_id);

alter table public.opening_adjustments enable row level security;

create policy "opening adjustments: the owner reads"
  on public.opening_adjustments for select to authenticated
  using (exists (
    select 1 from public.accounts a
    join public.shops s on s.id = a.shop_id
    join public.workspaces w on w.id = s.workspace_id
    where a.id = account_id and w.owner_id = (select auth.uid())
  ));

revoke all on public.opening_adjustments from anon, authenticated;
grant select on public.opening_adjustments to authenticated;

-- The owner sets an account's opening amount (minor units); the change and
-- the log row are one transaction. Someone else's account (or none) is
-- refused the same way. Returns the new amount.
create function public.set_opening_amount(account uuid, amount bigint, reason text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  before bigint;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select a.opening_amount into before
  from public.accounts a
  join public.shops s on s.id = a.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where a.id = account and w.owner_id = me
  for update of a;
  if not found then
    raise exception 'no such account' using errcode = '42501';
  end if;

  if amount < 0 then
    raise exception 'an opening amount can''t be negative' using errcode = '22023';
  end if;
  if amount = before then
    return amount;
  end if;

  update public.accounts set opening_amount = amount where id = account;
  insert into public.opening_adjustments (account_id, before_amount, after_amount, reason, changed_by)
  values (account, before, amount, nullif(btrim(reason), ''), me);
  return amount;
end;
$$;

revoke execute on function public.set_opening_amount(uuid, bigint, text) from public, anon;
grant execute on function public.set_opening_amount(uuid, bigint, text) to authenticated;
