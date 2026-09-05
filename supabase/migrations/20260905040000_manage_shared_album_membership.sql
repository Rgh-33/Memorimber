-- Atomic membership changes used by the shared-group UI. Direct writes to
-- shared_album_members remain unavailable to authenticated clients.
-- Lock the matching membership during each memory-link insertion. This makes
-- a concurrent leave/removal either wait for the insert and clean it up, or
-- complete first and make the insertion fail as no longer a member.
create or replace function private.require_current_shared_album_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
    from public.shared_album_members membership
    where membership.album_id = new.album_id
      and membership.user_id = new.added_by
    for key share;

  if not found then
    raise exception 'shared album membership not found' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.require_current_shared_album_membership()
  from public, anon, authenticated;

create trigger on_shared_album_memory_require_current_membership
  before insert on public.shared_album_memories
  for each row execute function private.require_current_shared_album_membership();

create or replace function public.leave_shared_album(
  target_album_id uuid,
  remove_shared_memories boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  album_owner_id uuid;
  removed_memory_count bigint := 0;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select album.owner_id
    into album_owner_id
    from public.shared_albums album
    where album.id = target_album_id
    for update;

  if album_owner_id is null then
    raise exception 'shared album not found' using errcode = 'P0002';
  end if;

  if album_owner_id = caller_id then
    raise exception 'shared album owner cannot leave' using errcode = '42501';
  end if;

  perform 1
    from public.shared_album_members membership
    where membership.album_id = target_album_id
      and membership.user_id = caller_id
      and membership.role = 'member'
    for update;

  if not found then
    raise exception 'shared album membership not found' using errcode = 'P0002';
  end if;

  delete from public.shared_album_members membership
    where membership.album_id = target_album_id
      and membership.user_id = caller_id
      and membership.role = 'member';

  if coalesce(remove_shared_memories, false) then
    delete from public.shared_album_memories album_memory
      where album_memory.album_id = target_album_id
        and album_memory.added_by = caller_id;
    get diagnostics removed_memory_count = row_count;
  end if;

  return removed_memory_count;
end;
$$;

revoke all on function public.leave_shared_album(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.leave_shared_album(uuid, boolean) to authenticated;

create or replace function public.remove_shared_album_member(
  target_album_id uuid,
  target_user_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  album_owner_id uuid;
  removed_memory_count bigint := 0;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select album.owner_id
    into album_owner_id
    from public.shared_albums album
    where album.id = target_album_id
    for update;

  if album_owner_id is null then
    raise exception 'shared album not found' using errcode = 'P0002';
  end if;

  if album_owner_id <> caller_id then
    raise exception 'only the shared album owner can remove members'
      using errcode = '42501';
  end if;

  if target_user_id = album_owner_id then
    raise exception 'shared album owner cannot be removed'
      using errcode = '42501';
  end if;

  perform 1
    from public.shared_album_members membership
    where membership.album_id = target_album_id
      and membership.user_id = target_user_id
      and membership.role = 'member'
    for update;

  if not found then
    raise exception 'shared album membership not found' using errcode = 'P0002';
  end if;

  delete from public.shared_album_members membership
    where membership.album_id = target_album_id
      and membership.user_id = target_user_id
      and membership.role = 'member';

  delete from public.shared_album_memories album_memory
    where album_memory.album_id = target_album_id
      and album_memory.added_by = target_user_id;
  get diagnostics removed_memory_count = row_count;

  return removed_memory_count;
end;
$$;

revoke all on function public.remove_shared_album_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_shared_album_member(uuid, uuid) to authenticated;
