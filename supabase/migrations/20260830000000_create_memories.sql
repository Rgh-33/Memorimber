-- Create the per-user memories table.
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  image_url text,
  storage_path text,
  caption text not null,
  people text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  constraint memories_caption_length check (char_length(caption) <= 80)
);

comment on table public.memories is 'Memories owned by authenticated users.';
comment on column public.memories.storage_path is 'Object path in the private memories Storage bucket.';

create index memories_user_id_date_idx
  on public.memories (user_id, date desc);

alter table public.memories enable row level security;

create policy "Users can read their own memories"
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

-- Keep memory images private and constrain uploads at the bucket level.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'memories',
  'memories',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Object names follow {user_id}/{memory_id}.{extension}. The first folder must
-- match the current authenticated user, preventing cross-user object access.
create policy "Users can read their own memory images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can upload their own memory images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can update their own memory images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete their own memory images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
