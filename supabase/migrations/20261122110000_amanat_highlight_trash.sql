-- Amanat, highlighted and in Trash: one can be marked to stand out (the
-- Highlighted tab), and deleted to Trash, from where it comes back as it was
-- or is deleted for good. Still written only through functions; the owner's only.

alter table public.amanat
  add column highlighted boolean not null default false,
  add column deleted_at timestamptz;

create index amanat_deleted_at on public.amanat (shop_id, deleted_at);

-- The amanat row, if it's the caller's (locked), else "no such amanat".
create function public.owned_amanat(target uuid)
returns public.amanat
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  found_row public.amanat;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select m.* into found_row
  from public.amanat m
  join public.shops s on s.id = m.shop_id
  join public.workspaces w on w.id = s.workspace_id
  where m.id = target and w.owner_id = me
  for update of m;
  if not found then
    raise exception 'no such amanat' using errcode = '42501';
  end if;
  return found_row;
end;
$$;

revoke execute on function public.owned_amanat(uuid) from public, anon, authenticated;

-- Highlighted or not.
create function public.highlight_amanat(amanat uuid, highlighted boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.owned_amanat(highlight_amanat.amanat);
  update public.amanat set highlighted = coalesce(highlight_amanat.highlighted, false) where id = highlight_amanat.amanat;
end;
$$;

-- To Trash. Already there: refused.
create function public.trash_amanat(amanat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.amanat;
begin
  rec := public.owned_amanat(trash_amanat.amanat);
  if rec.deleted_at is not null then
    raise exception 'already in Trash' using errcode = '22023';
  end if;
  update public.amanat set deleted_at = now() where id = trash_amanat.amanat;
end;
$$;

-- Back from Trash, as it was. Not in Trash: refused.
create function public.restore_amanat(amanat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.amanat;
begin
  rec := public.owned_amanat(restore_amanat.amanat);
  if rec.deleted_at is null then
    raise exception 'not in Trash' using errcode = '22023';
  end if;
  update public.amanat set deleted_at = null where id = restore_amanat.amanat;
end;
$$;

-- Out of Trash for good: only what's in Trash.
create function public.delete_amanat(amanat uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.amanat;
begin
  rec := public.owned_amanat(delete_amanat.amanat);
  if rec.deleted_at is null then
    raise exception 'only from Trash' using errcode = '22023';
  end if;
  delete from public.amanat where id = delete_amanat.amanat;
end;
$$;

revoke execute on function public.highlight_amanat(uuid, boolean) from public, anon;
revoke execute on function public.trash_amanat(uuid) from public, anon;
revoke execute on function public.restore_amanat(uuid) from public, anon;
revoke execute on function public.delete_amanat(uuid) from public, anon;
grant execute on function public.highlight_amanat(uuid, boolean) to authenticated;
grant execute on function public.trash_amanat(uuid) to authenticated;
grant execute on function public.restore_amanat(uuid) to authenticated;
grant execute on function public.delete_amanat(uuid) to authenticated;
