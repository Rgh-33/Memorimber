begin;

select plan(15);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('8a000000-0000-4000-8000-000000000001', 'thumbnail-owner@example.com', '{"display_name":"所有者"}'),
  ('8a000000-0000-4000-8000-000000000002', 'thumbnail-member@example.com', '{"display_name":"メンバー"}'),
  ('8a000000-0000-4000-8000-000000000003', 'thumbnail-outsider@example.com', '{"display_name":"非メンバー"}');

insert into public.memories (id, user_id, image_path, thumbnail_path, caption, memory_date)
values (
  '8a000000-0000-4000-8000-000000000011',
  '8a000000-0000-4000-8000-000000000001',
  '8a000000-0000-4000-8000-000000000001/original.jpg',
  '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp',
  'shared thumbnail repair',
  '2026-09-06'
);

insert into storage.objects (bucket_id, name)
values
  ('memory-images', '8a000000-0000-4000-8000-000000000001/original.jpg'),
  ('memory-images', '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp');

insert into public.shared_albums (id, owner_id, name)
values (
  '8a000000-0000-4000-8000-000000000021',
  '8a000000-0000-4000-8000-000000000001',
  'サムネイル修復確認'
);

insert into public.shared_album_members (album_id, user_id, role)
values (
  '8a000000-0000-4000-8000-000000000021',
  '8a000000-0000-4000-8000-000000000002',
  'member'
);

insert into public.shared_album_memories (album_id, memory_id, added_by)
values (
  '8a000000-0000-4000-8000-000000000021',
  '8a000000-0000-4000-8000-000000000011',
  '8a000000-0000-4000-8000-000000000001'
);

-- Reproduce the state left by the version collision. All fixture data and
-- definition changes are rolled back at the end of this test.
drop index if exists public.memories_thumbnail_path_idx;

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

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/original.jpg'$$,
  $$values ('8a000000-0000-4000-8000-000000000001/original.jpg'::text)$$,
  'the old definition allows a member to read the original'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'$$,
  'the old definition reproduces the missing shared thumbnail'
);

reset role;

-- Execute the real migration, not a copy of its repaired function.
\ir ../../migrations/20260906010000_reconcile_shared_memory_thumbnail_access.sql

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name in (
      '8a000000-0000-4000-8000-000000000001/original.jpg',
      '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'
    ) order by name$$,
  $$values
    ('8a000000-0000-4000-8000-000000000001/original.jpg'::text),
    ('8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'::text)$$,
  'the repair allows a member to read both the original and thumbnail'
);

select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000003', true);

select is_empty(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name in (
      '8a000000-0000-4000-8000-000000000001/original.jpg',
      '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'
    )$$,
  'a non-member cannot read either shared image'
);

select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('memory-images', '8a000000-0000-4000-8000-000000000001/thumbnails/unauthorized.webp')$$,
  '42501',
  null,
  'a member cannot upload into another owners thumbnail folder'
);

select is_empty(
  $$update storage.objects set name = name where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'
    returning name$$,
  'a member cannot update another owners shared thumbnail'
);

select is_empty(
  $$delete from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'
    returning name$$,
  'a member cannot delete another owners shared thumbnail'
);

reset role;

-- A second application must also succeed without duplicate objects.
\ir ../../migrations/20260906010000_reconcile_shared_memory_thumbnail_access.sql

select results_eq(
  $$select count(*)::bigint from pg_catalog.pg_indexes
    where schemaname = 'public'
      and tablename = 'memories'
      and indexname = 'memories_thumbnail_path_idx'$$,
  $$values (1::bigint)$$,
  'the repair creates the missing thumbnail index exactly once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'$$,
  $$values ('8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'::text)$$,
  'a repeated repair preserves member thumbnail access'
);

reset role;

select ok(
  has_function_privilege('authenticated', 'private.can_view_shared_memory_image(text)', 'execute'),
  'authenticated users retain permission to invoke the access helper'
);

select ok(
  not has_function_privilege('anon', 'private.can_view_shared_memory_image(text)', 'execute'),
  'anonymous users cannot invoke the access helper'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$delete from public.shared_album_memories
    where album_id = '8a000000-0000-4000-8000-000000000021'
      and memory_id = '8a000000-0000-4000-8000-000000000011'
    returning memory_id$$,
  $$values ('8a000000-0000-4000-8000-000000000011'::uuid)$$,
  'the owner can remove the shared-memory link'
);

select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000002', true);

select is_empty(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/original.jpg'$$,
  'removing the shared link revokes member access to the original'
);

select is_empty(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name = '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'$$,
  'removing the shared link revokes member access to the thumbnail'
);

select set_config('request.jwt.claim.sub', '8a000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select name from storage.objects where bucket_id = 'memory-images'
    and name in (
      '8a000000-0000-4000-8000-000000000001/original.jpg',
      '8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'
    ) order by name$$,
  $$values
    ('8a000000-0000-4000-8000-000000000001/original.jpg'::text),
    ('8a000000-0000-4000-8000-000000000001/thumbnails/shared-110x110.webp'::text)$$,
  'the owner retains both images and can read them after sharing is removed'
);

select * from finish();
rollback;
