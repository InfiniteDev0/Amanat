-- Invitations: the owner asks someone into a shop by phone, as an Editor, a
-- Viewer or another Owner. Each waits (pending) until it's accepted (next
-- step: the person signs in and joins), cancelled, or a week passes. One
-- waiting invitation per phone per shop. Owner-only, written by functions.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  role text not null check (role in ('owner', 'editor', 'viewer')),
  -- What the link carries; the person's sign-in will be checked against it.
  token uuid not null default gen_random_uuid() unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create unique index invitations_one_waiting on public.invitations (shop_id, phone) where status = 'pending';
create index invitations_shop_id on public.invitations (shop_id);

alter table public.invitations enable row level security;

create policy "invitations: the owner reads"
  on public.invitations for select to authenticated
  using (exists (
    select 1 from public.shops s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = shop_id and w.owner_id = (select auth.uid())
  ));

revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;

-- Invites a phone into the owner's shop with a right. Already waiting there:
-- refused. Returns the invitation's id.
create function public.invite_to_shop(shop uuid, phone text, role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.shops s
    join public.workspaces w on w.id = s.workspace_id
    where s.id = invite_to_shop.shop and w.owner_id = me
  ) then
    raise exception 'no such shop' using errcode = '42501';
  end if;
  if invite_to_shop.role not in ('owner', 'editor', 'viewer') then
    raise exception 'owner, editor or viewer' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.phone = invite_to_shop.phone) then
    raise exception 'that''s you' using errcode = '22023';
  end if;
  -- One left waiting a week is let go first.
  update public.invitations set status = 'expired'
  where shop_id = invite_to_shop.shop and status = 'pending' and expires_at < now();

  begin
    insert into public.invitations (shop_id, phone, role, invited_by)
    values (invite_to_shop.shop, invite_to_shop.phone, invite_to_shop.role, me)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'already invited' using errcode = '23505';
  end;
  return new_id;
end;
$$;

-- Cancels a waiting invitation.
create function public.cancel_invitation(invitation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.invitations i
  set status = 'cancelled'
  from public.shops s
  join public.workspaces w on w.id = s.workspace_id
  where i.id = cancel_invitation.invitation and s.id = i.shop_id and w.owner_id = me and i.status = 'pending';
  if not found then
    raise exception 'no such invitation' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.invite_to_shop(uuid, text, text) from public, anon;
revoke execute on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.invite_to_shop(uuid, text, text) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;
