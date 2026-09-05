begin;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11000000-0000-4000-8000-000000000001', 'flow-owner@example.com', '{"display_name":"オーナー"}'),
  ('22000000-0000-4000-8000-000000000002', 'flow-member@example.com', '{"display_name":"メンバー"}'),
  ('33000000-0000-4000-8000-000000000003', 'flow-outsider@example.com', '{"display_name":"部外者"}');

insert into public.memories (id, user_id, image_path, caption, memory_date)
values (
  '44000000-0000-4000-8000-000000000004',
  '22000000-0000-4000-8000-000000000002',
  '22000000-0000-4000-8000-000000000002/shared.jpg',
  'member memory',
  '2026-09-05'
);

insert into storage.objects (bucket_id, name)
values ('memory-images', '22000000-0000-4000-8000-000000000002/shared.jpg');

insert into public.shared_albums (id, owner_id, name)
values (
  '55000000-0000-4000-8000-000000000005',
  '11000000-0000-4000-8000-000000000001',
  '退出確認グループ'
);

insert into public.shared_album_members (album_id, user_id, role)
values (
  '55000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000002',
  'member'
);

insert into public.shared_album_memories (album_id, memory_id, added_by)
values (
  '55000000-0000-4000-8000-000000000005',
  '44000000-0000-4000-8000-000000000004',
  '22000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select public.leave_shared_album('55000000-0000-4000-8000-000000000005', false)$$,
  $$values (0::bigint)$$,
  'a member can leave while keeping their shared-memory links'
);

reset role;

select is_empty(
  $$select user_id from public.shared_album_members
    where album_id = '55000000-0000-4000-8000-000000000005'
      and user_id = '22000000-0000-4000-8000-000000000002'$$,
  'keeping links still removes formal membership'
);

select results_eq(
  $$select memory_id from public.shared_album_memories
    where album_id = '55000000-0000-4000-8000-000000000005'$$,
  $$values ('44000000-0000-4000-8000-000000000004'::uuid)$$,
  'the members link remains after the keep choice'
);

select results_eq(
  $$select id from public.memories where id = '44000000-0000-4000-8000-000000000004'$$,
  $$values ('44000000-0000-4000-8000-000000000004'::uuid)$$,
  'voluntary leave never deletes the original memory'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '22000000-0000-4000-8000-000000000002/shared.jpg'$$,
  $$values ('22000000-0000-4000-8000-000000000002/shared.jpg'::text)$$,
  'voluntary leave never deletes the original image'
);

insert into public.shared_album_members (album_id, user_id, role)
values (
  '55000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000002',
  'member'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select public.leave_shared_album('55000000-0000-4000-8000-000000000005', true)$$,
  $$values (1::bigint)$$,
  'a member can choose to remove their links while leaving'
);

reset role;

select is_empty(
  $$select user_id from public.shared_album_members
    where album_id = '55000000-0000-4000-8000-000000000005'
      and user_id = '22000000-0000-4000-8000-000000000002'$$,
  'the remove choice removes formal membership'
);

select is_empty(
  $$select memory_id from public.shared_album_memories
    where album_id = '55000000-0000-4000-8000-000000000005'$$,
  'the remove choice deletes the members links'
);

select results_eq(
  $$select id from public.memories where id = '44000000-0000-4000-8000-000000000004'$$,
  $$values ('44000000-0000-4000-8000-000000000004'::uuid)$$,
  'the remove choice keeps the original memory'
);

insert into public.shared_album_members (album_id, user_id, role)
values (
  '55000000-0000-4000-8000-000000000005',
  '22000000-0000-4000-8000-000000000002',
  'member'
);

insert into public.shared_album_memories (album_id, memory_id, added_by)
values (
  '55000000-0000-4000-8000-000000000005',
  '44000000-0000-4000-8000-000000000004',
  '22000000-0000-4000-8000-000000000002'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.leave_shared_album('55000000-0000-4000-8000-000000000005', false)$$,
  '42501',
  null,
  'an owner cannot use the normal leave flow'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '33000000-0000-4000-8000-000000000003', true);

select throws_ok(
  $$select public.leave_shared_album('55000000-0000-4000-8000-000000000005', false)$$,
  'P0002',
  null,
  'a non-member cannot leave a group they never joined'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22000000-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select public.remove_shared_album_member(
      '55000000-0000-4000-8000-000000000005',
      '22000000-0000-4000-8000-000000000002'
    )$$,
  '42501',
  null,
  'a regular member cannot forcibly remove members'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select public.remove_shared_album_member(
      '55000000-0000-4000-8000-000000000005',
      '22000000-0000-4000-8000-000000000002'
    )$$,
  $$values (1::bigint)$$,
  'the owner can remove a member and their links atomically'
);

reset role;

select is_empty(
  $$select user_id from public.shared_album_members
    where album_id = '55000000-0000-4000-8000-000000000005'
      and user_id = '22000000-0000-4000-8000-000000000002'$$,
  'forced removal deletes formal membership'
);

select is_empty(
  $$select memory_id from public.shared_album_memories
    where album_id = '55000000-0000-4000-8000-000000000005'$$,
  'forced removal deletes the targets links'
);

select results_eq(
  $$select id from public.memories where id = '44000000-0000-4000-8000-000000000004'$$,
  $$values ('44000000-0000-4000-8000-000000000004'::uuid)$$,
  'forced removal keeps the targets original memory'
);

select results_eq(
  $$select name from storage.objects
    where bucket_id = 'memory-images'
      and name = '22000000-0000-4000-8000-000000000002/shared.jpg'$$,
  $$values ('22000000-0000-4000-8000-000000000002/shared.jpg'::text)$$,
  'forced removal keeps the targets original image'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.remove_shared_album_member(
      '55000000-0000-4000-8000-000000000005',
      '11000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  null,
  'the owner membership cannot be removed'
);

select * from finish();
rollback;
