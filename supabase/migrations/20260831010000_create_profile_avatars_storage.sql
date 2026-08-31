-- Profile avatars have different size and lifecycle requirements from memory photos,
-- so keep them in their own private bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can view their own profile avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload their own profile avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own profile avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own profile avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
