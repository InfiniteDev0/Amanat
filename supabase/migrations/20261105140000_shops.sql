-- Phase 2a: more than one shop. "+ New shop" adds a shop with its accounts and
-- opening amounts; "Set as main" moves the ★; a shop that isn't the main one
-- can be deleted. Each is one function, so each is one transaction.
--
-- Exactly one main shop per business: at most one is enforced by the partial
-- unique index shops_one_main (1d); at least one by these functions (the
-- main can't be deleted, and setting a new main unsets the old one in the
-- same transaction). Still one owner per business (RLS owner_id = auth.uid());
-- team roles come in 1e.

-- The caller's business (one per owner for now), or an error.
create function public.my_workspace()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.workspaces where owner_id = auth.uid() order by created_at limit 1;
$$;

-- The shop's business if the caller owns it, else an error (the same one for
-- "not yours" and "doesn't exist": nobody learns which shops exist).
create function public.owned_shop_workspace(shop uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found_workspace uuid;
begin
  select s.workspace_id into found_workspace
  from public.shops s join public.workspaces w on w.id = s.workspace_id
  where s.id = shop and w.owner_id = auth.uid();
  if found_workspace is null then
    raise exception 'no such shop' using errcode = '42501';
  end if;
  return found_workspace;
end;
$$;

-- ── + New shop ───────────────────────────────────────────────────────────────
-- `setup`: { "name", "location", "large_row_limit"?,
--            "accounts": [ { "name", "type", "currency", "provider"?, "opening_amount" } ] }
-- Returns the new shop's id. Any failure rolls the whole thing back.

create function public.create_shop(setup jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  business uuid;
  traded text[];
  new_shop uuid;
  account jsonb;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  business := public.my_workspace();
  if business is null then
    raise exception 'finish setup first' using errcode = '22023';
  end if;
  select currencies into traded from public.workspaces where id = business;

  insert into public.shops (workspace_id, name, location, is_main, large_row_limit)
  values (
    business,
    btrim(setup ->> 'name'),
    coalesce(btrim(setup ->> 'location'), ''),
    false,
    coalesce((setup ->> 'large_row_limit')::bigint, 500000)
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

  return new_shop;
end;
$$;

-- ── Set as main ──────────────────────────────────────────────────────────────

create function public.set_main_shop(shop uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  business uuid := public.owned_shop_workspace(shop);
begin
  -- The old main first, so the one-main index never sees two.
  update public.shops set is_main = false where workspace_id = business and is_main and id <> shop;
  update public.shops set is_main = true where id = shop;
end;
$$;

-- ── Delete a shop ────────────────────────────────────────────────────────────
-- Never the main one: set another as main first. Its accounts go with it
-- (no money has been recorded yet; that will need its own rule in Phase 3).

create function public.delete_shop(shop uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  business uuid := public.owned_shop_workspace(shop);
begin
  if exists (select 1 from public.shops where id = shop and is_main) then
    raise exception 'the main shop can''t be deleted' using errcode = 'P0001', hint = 'main_shop';
  end if;
  delete from public.shops where id = shop and workspace_id = business;
end;
$$;

revoke execute on function public.my_workspace() from public, anon, authenticated;
revoke execute on function public.owned_shop_workspace(uuid) from public, anon, authenticated;
revoke execute on function public.create_shop(jsonb) from public, anon;
revoke execute on function public.set_main_shop(uuid) from public, anon;
revoke execute on function public.delete_shop(uuid) from public, anon;
grant execute on function public.create_shop(jsonb) to authenticated;
grant execute on function public.set_main_shop(uuid) to authenticated;
grant execute on function public.delete_shop(uuid) to authenticated;
