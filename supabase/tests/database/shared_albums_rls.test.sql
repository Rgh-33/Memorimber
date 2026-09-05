begin;

select plan(56);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.com', '{"display_name":"オーナー"}'),
  ('20000000-0000-0000-0000-000000000002', 'member@example.com', '{"display_name":"メンバー"}'),
  ('30000000-0000-0000-0000-000000000003', 'outsider@example.com', '{"display_name":"部外者"}');

insert into public.memories (id, user_id, image_path, caption, memory_date)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001/owner.jpg',
    'owner memory',
    '2026-09-01'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002/member.jpg',
    'member memory',
    '2026-09-02'
  ),
  (
    'c0000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003',
    '30000000-0000-0000-0000-000000000003/outsider.jpg',
    'outsider memory',
    '2026-09-03'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001/private.jpg',
    'unshared owner memory',
    '2026-09-04'
  );

insert into storage.objects (bucket_id, name)
values
  ('memory-images', '10000000-0000-0000-0000-000000000001/owner.jpg'),
  ('memory-images', '10000000-0000-0000-0000-000000000001/private.jpg'),
  ('memory-images', '20000000-0000-0000-0000-000000000002/member.jpg'),
  ('memory-images', '30000000-0000-0000-0000-000000000003/outsider.jpg');

update public.memories
set thumbnail_path = '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'
where id = 'a0000000-0000-0000-0000-000000000001';

insert into storage.objects (bucket_id, name)
values (
  'memory-images',
  '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'
);

-- Capture INSERT ... RETURNING separately: results_eq opens a cursor, which
-- cannot execute a data-modifying CTE. Only this temporary result table needs
-- extra grants; shared album writes still use the normal authenticated RLS.
create temporary table created_shared_album_result (
  id uuid,
  owner_id uuid,
  name text,
  created_at timestamptz,
  updated_at timestamptz
) on commit drop;

grant insert, select on table pg_temp.created_shared_album_result to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$with created as (
    insert into public.shared_albums (name) values ('家族の思い出')
    returning id, owner_id, name, created_at, updated_at
  )
  insert into pg_temp.created_shared_album_result (id, owner_id, name, created_at, updated_at)
  select id, owner_id, name, created_at, updated_at
  from created$$,
  'an authenticated user can create a shared album and return it in the same statement'
);

select results_eq(
  $$select id is not null, owner_id, name, created_at = now(), updated_at = now()
    from pg_temp.created_shared_album_result$$,
  $$values (true, '10000000-0000-0000-0000-000000000001'::uuid, '家族の思い出'::text, true, true)$$,
  'album creation returns its generated ID, owner, name and timestamps like the app request'
);

select throws_ok(
  $$insert into public.shared_albums (name, owner_id)
    values ('偽装した所有者', '20000000-0000-0000-0000-000000000002')
    returning id, owner_id, name, created_at, updated_at$$,
  '42501',
  null,
  'clients cannot create an album owned by another user'
);

reset role;

select results_eq(
  $$select role from public.shared_album_members where album_id = (select id from public.shared_albums where name = '家族の思い出')$$,
  $$values ('owner'::text)$$,
  'album creation atomically adds its creator as owner'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.shared_albums (name) values ('旅行の思い出')$$,
  'a user can create a second shared album'
);

reset role;

select results_eq(
  $$select role from public.shared_album_members where album_id = (select id from public.shared_albums where name = '旅行の思い出')$$,
  $$values ('owner'::text)$$,
  'the second album also receives exactly one owner'
);

select set_config(
  'test.shared_album_family',
  (select id::text from public.shared_albums where name = '家族の思い出'),
  true
);
select set_config(
  'test.shared_album_trip',
  (select id::text from public.shared_albums where name = '旅行の思い出'),
  true
);

insert into public.shared_album_members (album_id, user_id, role)
select id, '20000000-0000-0000-0000-000000000002', 'member'
from public.shared_albums;

select results_eq(
  $$select count(*)::bigint from public.shared_album_members where user_id = '20000000-0000-0000-0000-000000000002'$$,
  $$values (2::bigint)$$,
  'the same user can belong to multiple groups'
);

select throws_ok(
  $$insert into public.shared_album_members (album_id, user_id, role)
    select id, '30000000-0000-0000-0000-000000000003', 'owner'
    from public.shared_albums where name = '家族の思い出'$$,
  '23514',
  null,
  'a second owner role is rejected'
);

select throws_ok(
  $$insert into public.shared_album_members (album_id, user_id, role)
    select id, '20000000-0000-0000-0000-000000000002', 'member'
    from public.shared_albums where name = '家族の思い出'$$,
  '23505',
  null,
  'duplicate album membership is rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$delete from public.shared_album_members
    where album_id = (select id from public.shared_albums where name = '家族の思い出')
      and role = 'owner'$$,
  '42501',
  null,
  'clients cannot directly remove an owner membership'
);

reset role;

select throws_ok(
  $$update public.shared_albums
    set owner_id = '20000000-0000-0000-0000-000000000002'
    where name = '家族の思い出'$$,
  '23514',
  null,
  'album ownership is immutable'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$insert into public.shared_albums (name) values ('')$$,
  '23514',
  null,
  'a blank album name is rejected'
);

select throws_ok(
  $$insert into public.shared_albums (name) values (repeat('a', 61))$$,
  '23514',
  null,
  'an album name longer than 60 characters is rejected'
);

select lives_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'a0000000-0000-0000-0000-000000000001'
    from public.shared_albums where name = '家族の思い出'$$,
  'the owner can add their own memory'
);

select lives_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'a0000000-0000-0000-0000-000000000001'
    from public.shared_albums where name = '旅行の思い出'$$,
  'the same memory can be shared to another group'
);

select throws_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'a0000000-0000-0000-0000-000000000001'
    from public.shared_albums where name = '家族の思い出'$$,
  '23505',
  null,
  'the same memory cannot be duplicated within one group'
);

select throws_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'b0000000-0000-0000-0000-000000000002'
    from public.shared_albums where name = '家族の思い出'$$,
  '42501',
  null,
  'even an owner cannot add another users memory'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'b0000000-0000-0000-0000-000000000002'
    from public.shared_albums where name = '家族の思い出'$$,
  'a member can add their own memory'
);

select throws_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'd0000000-0000-0000-0000-000000000004'
    from public.shared_albums where name = '家族の思い出'$$,
  '42501',
  null,
  'a member cannot add another users memory'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    values (
      current_setting('test.shared_album_family')::uuid,
      'c0000000-0000-0000-0000-000000000003'
    )$$,
  '42501',
  null,
  'a non-member cannot add their memory to an existing album'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select count(*)::bigint from public.shared_albums$$,
  $$values (2::bigint)$$,
  'the owner can see both groups'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select count(*)::bigint from public.shared_albums$$,
  $$values (2::bigint)$$,
  'a formal member can see every group they joined'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select id from public.shared_albums$$,
  'a non-member cannot see groups'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select count(*)::bigint from public.shared_album_members
    where album_id = (select id from public.shared_albums where name = '家族の思い出')$$,
  $$values (2::bigint)$$,
  'a member can see fellow members'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select album_id from public.shared_album_members$$,
  'a non-member cannot see membership rows'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select count(*)::bigint from public.shared_album_memories
    where album_id = (select id from public.shared_albums where name = '家族の思い出')$$,
  $$values (2::bigint)$$,
  'a member can see the groups shared-memory links'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select album_id from public.shared_album_memories$$,
  'a non-member cannot see shared-memory links'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$select id from public.memories where id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'a member can read another members shared memory'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select id from public.memories where id = 'a0000000-0000-0000-0000-000000000001'$$,
  'a non-member cannot read another users shared memory'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$select id from public.memories where id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'the existing owner memory SELECT policy remains effective'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/private.jpg'$$,
  $$values ('10000000-0000-0000-0000-000000000001/private.jpg'::text)$$,
  'the existing owner image SELECT policy remains effective without a shared link'
);

select results_eq(
  $$update storage.objects set name = name
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/private.jpg'
    returning name$$,
  $$values ('10000000-0000-0000-0000-000000000001/private.jpg'::text)$$,
  'the existing owner image UPDATE policy remains effective'
);

select results_eq(
  $$delete from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/private.jpg'
    returning name$$,
  $$values ('10000000-0000-0000-0000-000000000001/private.jpg'::text)$$,
  'the existing owner image DELETE policy remains effective'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select is_empty(
  $$update public.memories set caption = 'hacked'
    where id = 'a0000000-0000-0000-0000-000000000001' returning id$$,
  'a member cannot update another users shared memory'
);

select is_empty(
  $$delete from public.memories
    where id = 'a0000000-0000-0000-0000-000000000001' returning id$$,
  'a member cannot delete another users shared memory'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/owner.jpg'$$,
  $$values ('10000000-0000-0000-0000-000000000001/owner.jpg'::text)$$,
  'a member can select another users shared image'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'$$,
  $$values ('10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'::text)$$,
  'a member can select another users shared thumbnail'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/owner.jpg'$$,
  'a non-member cannot select a shared image'
);

select is_empty(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'$$,
  'a non-member cannot select a shared thumbnail'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select is_empty(
  $$update storage.objects set name = name
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/owner.jpg'
    returning name$$,
  'a member cannot update another users shared image'
);

select is_empty(
  $$update storage.objects set name = name
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'
    returning name$$,
  'a member cannot update another users shared thumbnail'
);

select is_empty(
  $$delete from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/owner.jpg'
    returning name$$,
  'a member cannot delete another users shared image'
);

select is_empty(
  $$delete from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/thumbnails/a0000000-0000-0000-0000-000000000001-110x110.webp'
    returning name$$,
  'a member cannot delete another users shared thumbnail'
);

select is_empty(
  $$delete from public.shared_albums
    where name = '家族の思い出' returning id$$,
  'a non-owner cannot delete a shared album'
);

select results_eq(
  $$select count(*)::bigint from public.list_shared_album_members(
      (select id from public.shared_albums where name = '家族の思い出')
    )$$,
  $$values (2::bigint)$$,
  'a member can retrieve display names through the restricted member RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select is_empty(
  $$select * from public.list_shared_album_members(
      current_setting('test.shared_album_family')::uuid
    )$$,
  'the member RPC reveals nothing to a non-member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select results_eq(
  $$delete from public.shared_album_memories
    where album_id = (select id from public.shared_albums where name = '家族の思い出')
      and memory_id = 'b0000000-0000-0000-0000-000000000002'
    returning memory_id$$,
  $$values ('b0000000-0000-0000-0000-000000000002'::uuid)$$,
  'the owner can remove a members shared-memory link'
);

reset role;

select results_eq(
  $$select id from public.memories where id = 'b0000000-0000-0000-0000-000000000002'$$,
  $$values ('b0000000-0000-0000-0000-000000000002'::uuid)$$,
  'removing a shared-memory link keeps the original memory'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '20000000-0000-0000-0000-000000000002/member.jpg'$$,
  $$values ('20000000-0000-0000-0000-000000000002/member.jpg'::text)$$,
  'removing a shared-memory link keeps the original image'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$insert into public.shared_albums (name) values ('削除確認')$$,
  'the owner can create an album for cascade verification'
);

select lives_ok(
  $$insert into public.shared_album_memories (album_id, memory_id)
    select id, 'a0000000-0000-0000-0000-000000000001'
    from public.shared_albums where name = '削除確認'$$,
  'a memory can be linked to the cascade-verification album'
);

select set_config(
  'test.shared_album_delete',
  (select id::text from public.shared_albums where name = '削除確認'),
  true
);

select lives_ok(
  $$delete from public.shared_albums where name = '削除確認'$$,
  'the owner can delete a shared album'
);

reset role;

select is_empty(
  $$select album_id from public.shared_album_members
    where album_id = current_setting('test.shared_album_delete')::uuid$$,
  'album deletion cascades to membership rows'
);

select is_empty(
  $$select album_id from public.shared_album_memories
    where album_id = current_setting('test.shared_album_delete')::uuid$$,
  'album deletion cascades to shared-memory links'
);

select results_eq(
  $$select id from public.memories where id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'album deletion keeps the original memory'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '10000000-0000-0000-0000-000000000001/owner.jpg'$$,
  $$values ('10000000-0000-0000-0000-000000000001/owner.jpg'::text)$$,
  'album deletion keeps the original image'
);

select * from finish();
rollback;
