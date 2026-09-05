alter table public.memories
  add column if not exists thumbnail_path text;

alter table public.memories
  drop constraint if exists memories_thumbnail_path_not_blank;

alter table public.memories
  add constraint memories_thumbnail_path_not_blank
  check (
    thumbnail_path is null
    or btrim(thumbnail_path) <> ''
  );

alter table public.memories
  drop constraint if exists memories_thumbnail_path_owned_by_user;

alter table public.memories
  add constraint memories_thumbnail_path_owned_by_user
  check (
    thumbnail_path is null
    or (
      coalesce(
        (storage.foldername(thumbnail_path))[1] = user_id::text,
        false
      )
      and coalesce(
        (storage.foldername(thumbnail_path))[2] = 'thumbnails',
        false
      )
      and thumbnail_path ~ ('^' || user_id::text || '/thumbnails/[^/].*')
    )
  );

comment on column public.memories.thumbnail_path is
  'Optional thumbnail object path under <user-id>/thumbnails/ in the private memory-images Storage bucket';

grant insert (thumbnail_path), update (thumbnail_path)
  on table public.memories to authenticated;
