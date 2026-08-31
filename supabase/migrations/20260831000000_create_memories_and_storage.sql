-- Store each memory under its owner. The image itself lives in the private
-- `memory-images` Storage bucket; `image_path` contains only its object path.
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_path text not null,
  caption text not null,
  memory_date date not null,
  people text[] not null default '{}',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_image_path_not_blank check (btrim(image_path) <> ''),
  constraint memories_caption_not_blank check (btrim(caption) <> ''),
  constraint memories_caption_length check (char_length(caption) <= 80),
  constraint memories_image_path_owned_by_user check (
    (storage.foldername(image_path))[1] = user_id::text
  )
);

comment on table public.memories is 'Photo and caption memories owned by an authenticated user';
comment on column public.memories.image_path is 'Object path in the private memory-images Storage bucket';

create index memories_user_date_idx
  on public.memories (user_id, memory_date desc, created_at desc);

alter table public.memories enable row level security;

create policy "Users can view their own memories"
  on public.memories
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own memories"
  on public.memories
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own memories"
  on public.memories
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own memories"
  on public.memories
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.memories from anon, authenticated;
grant select, insert, update, delete on table public.memories to authenticated;

create or replace function public.set_memory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_memory_updated_at() from public;

create trigger on_memory_updated_set_updated_at
  before update on public.memories
  for each row execute function public.set_memory_updated_at();

-- Keep memory photos private. Object names must use `<user-id>/<file-name>` so
-- Storage RLS can apply the same ownership boundary as the memories table.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memory-images',
  'memory-images',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their own memory images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'memory-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload their own memory images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'memory-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own memory images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'memory-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'memory-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own memory images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'memory-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
