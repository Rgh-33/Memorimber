-- Shared album members may read the optional derivative as well as the
-- original. This only extends SELECT; existing owner-only write policies are
-- intentionally unchanged.

create index if not exists memories_thumbnail_path_idx
  on public.memories (thumbnail_path)
  where thumbnail_path is not null;

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
      where (
          memory.image_path = object_name
          or memory.thumbnail_path = object_name
        )
        and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function private.can_view_shared_memory_image(text) from public, anon, authenticated;
grant execute on function private.can_view_shared_memory_image(text) to authenticated;
