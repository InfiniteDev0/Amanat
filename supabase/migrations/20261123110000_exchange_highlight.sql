-- Exchanges highlighted on the Profit page (several at once): a colour's
-- name ("amber"), or null for none. The owner's own, through the function.

alter table public.exchanges add column highlight text check (highlight ~ '^[a-z]{3,12}$');

create function public.highlight_exchanges(ids uuid[], colour text)
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
  set highlight = nullif(btrim(highlight_exchanges.colour), '')
  from public.shops s
  join public.workspaces w on w.id = s.workspace_id
  where x.id = any (highlight_exchanges.ids) and s.id = x.shop_id and w.owner_id = me;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.highlight_exchanges(uuid[], text) from public, anon;
grant execute on function public.highlight_exchanges(uuid[], text) to authenticated;
