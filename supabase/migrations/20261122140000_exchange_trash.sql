-- Exchanges deleted, and brought back (Undo): the owner's own, several at once.
-- A deleted exchange stays in the table (deleted_at), off every list.

create function public.trash_exchanges(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  changed integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.exchanges x
  set deleted_at = now()
  from public.shops s
  join public.workspaces w on w.id = s.workspace_id
  where x.id = any (trash_exchanges.ids) and s.id = x.shop_id and w.owner_id = me and x.deleted_at is null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

create function public.restore_exchanges(ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  changed integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.exchanges x
  set deleted_at = null
  from public.shops s
  join public.workspaces w on w.id = s.workspace_id
  where x.id = any (restore_exchanges.ids) and s.id = x.shop_id and w.owner_id = me and x.deleted_at is not null;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.trash_exchanges(uuid[]) from public, anon;
revoke execute on function public.restore_exchanges(uuid[]) from public, anon;
grant execute on function public.trash_exchanges(uuid[]) to authenticated;
grant execute on function public.restore_exchanges(uuid[]) to authenticated;
