-- Shared albums are authenticated, account-bound groups. Photos and captions
-- remain in public.memories; this migration only stores membership and links.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.shared_albums (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_albums_name_format check (
    name = btrim(name)
    and char_length(name) between 1 and 60
  )
);

create table public.shared_album_members (
  album_id uuid not null references public.shared_albums (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (album_id, user_id),
  constraint shared_album_members_role check (role in ('owner', 'member'))
);

create unique index shared_album_members_one_owner_idx
  on public.shared_album_members (album_id)
  where role = 'owner';

create index shared_album_members_user_idx
  on public.shared_album_members (user_id, album_id);

create table public.shared_album_memories (
  album_id uuid not null references public.shared_albums (id) on delete cascade,
  memory_id uuid not null references public.memories (id) on delete cascade,
  added_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (album_id, memory_id)
);

create index shared_album_memories_memory_idx
  on public.shared_album_memories (memory_id, album_id);

create index shared_album_memories_added_by_idx
  on public.shared_album_memories (added_by, album_id);

create index memories_image_path_idx
  on public.memories (image_path);

comment on table public.shared_albums is 'Private shared-memory groups; one group is one shared album';
comment on table public.shared_album_members is 'Formal shared album members and their owner/member role';
comment on table public.shared_album_memories is 'References existing memories without duplicating photo or caption data';

create or replace function private.set_shared_album_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_shared_album_updated_at() from public, anon, authenticated;

create trigger on_shared_album_updated_set_updated_at
  before update on public.shared_albums
  for each row execute function private.set_shared_album_updated_at();

create or replace function private.prevent_shared_album_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'shared album owner cannot be changed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_shared_album_owner_change() from public, anon, authenticated;

create trigger on_shared_album_updated_prevent_owner_change
  before update of owner_id on public.shared_albums
  for each row execute function private.prevent_shared_album_owner_change();

-- Prevent mismatched owner/member roles during privileged maintenance writes.
-- Client roles receive no direct member mutation grants.
create or replace function private.enforce_shared_album_member_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  album_owner uuid;
begin
  select owner_id
    into album_owner
    from public.shared_albums
    where id = new.album_id;

  if album_owner is null then
    raise exception 'shared album does not exist' using errcode = '23503';
  end if;

  if (new.role = 'owner') <> (new.user_id = album_owner) then
    raise exception 'shared album owner role must match owner_id' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_shared_album_member_role() from public, anon, authenticated;

create trigger on_shared_album_member_enforce_role
  before insert or update on public.shared_album_members
  for each row execute function private.enforce_shared_album_member_role();

create or replace function private.add_shared_album_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shared_album_members (album_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

revoke all on function private.add_shared_album_owner_membership() from public, anon, authenticated;

create trigger on_shared_album_created_add_owner
  after insert on public.shared_albums
  for each row execute function private.add_shared_album_owner_membership();

-- These helpers are kept outside the exposed public schema. Running them as
-- the migration owner breaks otherwise-recursive membership RLS evaluation.
create or replace function private.is_shared_album_member(target_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.shared_album_members membership
      where membership.album_id = target_album_id
        and membership.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_shared_album_owner(target_album_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.shared_albums album
      where album.id = target_album_id
        and album.owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_shared_memory(target_memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.shared_album_memories album_memory
      join public.shared_album_members membership
        on membership.album_id = album_memory.album_id
      where album_memory.memory_id = target_memory_id
        and membership.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_view_shared_memory_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memories memory
      join public.shared_album_memories album_memory
        on album_memory.memory_id = memory.id
      join public.shared_album_members membership
        on membership.album_id = album_memory.album_id
      where memory.image_path = object_name
        and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_shared_album_member(uuid) from public, anon, authenticated;
revoke all on function private.is_shared_album_owner(uuid) from public, anon, authenticated;
revoke all on function private.can_view_shared_memory(uuid) from public, anon, authenticated;
revoke all on function private.can_view_shared_memory_image(text) from public, anon, authenticated;
grant execute on function private.is_shared_album_member(uuid) to authenticated;
grant execute on function private.is_shared_album_owner(uuid) to authenticated;
grant execute on function private.can_view_shared_memory(uuid) to authenticated;
grant execute on function private.can_view_shared_memory_image(text) to authenticated;

alter table public.shared_albums enable row level security;
alter table public.shared_album_members enable row level security;
alter table public.shared_album_memories enable row level security;

create policy "Members can view shared albums"
  on public.shared_albums
  for select
  to authenticated
  using ((select private.is_shared_album_member(id)));

create policy "Users can create owned shared albums"
  on public.shared_albums
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners can rename shared albums"
  on public.shared_albums
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete shared albums"
  on public.shared_albums
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Members can view fellow members"
  on public.shared_album_members
  for select
  to authenticated
  using ((select private.is_shared_album_member(album_id)));

create policy "Members can view shared album memories"
  on public.shared_album_memories
  for select
  to authenticated
  using ((select private.is_shared_album_member(album_id)));

create policy "Members can add their own memories"
  on public.shared_album_memories
  for insert
  to authenticated
  with check (
    added_by = (select auth.uid())
    and (select private.is_shared_album_member(album_id))
    and exists (
      select 1
        from public.memories memory
        where memory.id = memory_id
          and memory.user_id = (select auth.uid())
    )
  );

create policy "Adders and owners can remove shared memories"
  on public.shared_album_memories
  for delete
  to authenticated
  using (
    added_by = (select auth.uid())
    or (select private.is_shared_album_owner(album_id))
  );

revoke all on table public.shared_albums from anon, authenticated;
revoke all on table public.shared_album_members from anon, authenticated;
revoke all on table public.shared_album_memories from anon, authenticated;

grant select, delete on table public.shared_albums to authenticated;
grant insert (name), update (name) on table public.shared_albums to authenticated;
grant select on table public.shared_album_members to authenticated;
grant select, delete on table public.shared_album_memories to authenticated;
grant insert (album_id, memory_id) on table public.shared_album_memories to authenticated;

-- Keep profiles private. This RPC returns only the display fields needed by a
-- caller who is already a formal member of the requested shared album.
create or replace function public.list_shared_album_members(target_album_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.user_id, profile.display_name, membership.role, membership.joined_at
    from public.shared_album_members membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.album_id = target_album_id
      and (select private.is_shared_album_member(target_album_id))
    order by (membership.role = 'owner') desc, membership.joined_at, membership.user_id;
$$;

revoke all on function public.list_shared_album_members(uuid) from public, anon, authenticated;
grant execute on function public.list_shared_album_members(uuid) to authenticated;

create policy "Shared album members can view shared memories"
  on public.memories
  for select
  to authenticated
  using ((select private.can_view_shared_memory(id)));

create policy "Shared album members can view shared memory images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'memory-images'
    and (select private.can_view_shared_memory_image(name))
  );
