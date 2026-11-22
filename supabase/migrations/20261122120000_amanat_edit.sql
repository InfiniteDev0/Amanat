-- Amanat, changed: the customer's name, the note, and, while it's still held,
-- the account (in the same shop) and the amount. Once given back, the money
-- has left: its amount and account stay as they were. Owner-only.

create function public.update_amanat(amanat uuid, account uuid, client_name text, amount bigint, note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.amanat;
  acc record;
begin
  rec := public.owned_amanat(update_amanat.amanat);
  if rec.deleted_at is not null then
    raise exception 'it''s in Trash' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(update_amanat.client_name, ''))) < 2 then
    raise exception 'the customer''s name is needed' using errcode = '22023';
  end if;
  if update_amanat.amount is null or update_amanat.amount <= 0 then
    raise exception 'amanat must be more than nothing' using errcode = '22023';
  end if;

  select a.id, a.currency, a.archived into acc
  from public.accounts a
  where a.id = update_amanat.account and a.shop_id = rec.shop_id;
  if not found then
    raise exception 'no such account in this shop' using errcode = '22023';
  end if;
  if acc.archived and acc.id <> rec.account_id then
    raise exception 'that account is archived' using errcode = '22023';
  end if;
  if rec.returned_at is not null and (acc.id <> rec.account_id or update_amanat.amount <> rec.amount) then
    raise exception 'given back: its amount and account stay' using errcode = '22023';
  end if;

  update public.amanat
  set client_name = btrim(update_amanat.client_name),
      account_id = acc.id,
      currency = acc.currency,
      amount = update_amanat.amount,
      note = nullif(btrim(update_amanat.note), '')
  where id = update_amanat.amanat;
end;
$$;

revoke execute on function public.update_amanat(uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.update_amanat(uuid, uuid, text, bigint, text) to authenticated;
