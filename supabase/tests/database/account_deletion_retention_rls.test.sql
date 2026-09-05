begin;

select plan(20);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('84000000-0000-4000-8000-000000000001', 'leaver-84@example.com', '{"display_name":"退会する人"}'),
  ('84000000-0000-4000-8000-000000000002', 'owner-84@example.com', '{"display_name":"残るオーナー"}'),
  ('84000000-0000-4000-8000-000000000003', 'outsider-84@example.com', '{"display_name":"部外者"}');

update public.profiles
set avatar_url = '84000000-0000-4000-8000-000000000001/avatar.jpg'
where id = '84000000-0000-4000-8000-000000000001';

insert into public.memories (id, user_id, image_path, thumbnail_path, caption, memory_date)
values
  (
    '84000000-0000-4000-8000-000000000011',
    '84000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001/retained.jpg',
    '84000000-0000-4000-8000-000000000001/thumbnails/retained.webp',
    '共有中の思い出',
    '2026-09-01'
  ),
  (
    '84000000-0000-4000-8000-000000000012',
    '84000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001/private.jpg',
    null,
    '非共有の思い出',
    '2026-09-02'
  ),
  (
    '84000000-0000-4000-8000-000000000013',
    '84000000-0000-4000-8000-000000000002',
    '84000000-0000-4000-8000-000000000002/owner.jpg',
    null,
    '残る人の思い出',
    '2026-09-03'
  );

insert into public.shared_albums (id, owner_id, name)
values
  ('84000000-0000-4000-8000-000000000021', '84000000-0000-4000-8000-000000000002', '残るグループ'),
  ('84000000-0000-4000-8000-000000000022', '84000000-0000-4000-8000-000000000001', '消えるグループ');

insert into public.shared_album_members (album_id, user_id, role)
values
  ('84000000-0000-4000-8000-000000000021', '84000000-0000-4000-8000-000000000001', 'member'),
  ('84000000-0000-4000-8000-000000000022', '84000000-0000-4000-8000-000000000002', 'member');

insert into public.shared_album_memories (album_id, memory_id, added_by)
values
  ('84000000-0000-4000-8000-000000000021', '84000000-0000-4000-8000-000000000011', '84000000-0000-4000-8000-000000000001'),
  ('84000000-0000-4000-8000-000000000022', '84000000-0000-4000-8000-000000000013', '84000000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$select public.prepare_my_account_deletion(true)$$,
  'the authenticated account can prepare retained deletion'
);

reset role;

select is_empty(
  $$select id from public.shared_albums where id = '84000000-0000-4000-8000-000000000022'$$,
  'groups owned by the leaving account are deleted'
);

select results_eq(
  $$select id from public.memories where id = '84000000-0000-4000-8000-000000000013'$$,
  $$values ('84000000-0000-4000-8000-000000000013'::uuid)$$,
  'other members original memories survive owner group deletion'
);

select results_eq(
  $$select memory_id from public.account_deletion_retained_memories$$,
  $$values ('84000000-0000-4000-8000-000000000011'::uuid)$$,
  'only a memory shared into another owners group is selected for retention'
);

select results_eq(
  $$select count(*)::bigint from public.account_deletion_storage_tasks where operation = 'move'$$,
  $$values (2::bigint)$$,
  'original and thumbnail receive move tasks'
);

select results_eq(
  $$select count(*)::bigint from public.account_deletion_storage_tasks where operation = 'delete'$$,
  $$values (2::bigint)$$,
  'private memory and avatar receive delete tasks'
);

update public.account_deletion_storage_tasks
set status = 'completed', completed_at = now();

set local role service_role;
select results_eq(
  $$select public.finalize_account_deletion_job((select id from public.account_deletion_jobs))$$,
  $$values ('ready_for_auth'::text)$$,
  'service processing finalizes the database stage'
);
reset role;

select results_eq(
  $$select retained_owner_name from public.memories where id = '84000000-0000-4000-8000-000000000011'$$,
  $$values ('退会する人'::text)$$,
  'retained memory stores the former owners display name snapshot'
);

select results_eq(
  $$select image_path from public.memories where id = '84000000-0000-4000-8000-000000000011'$$,
  $$values ('retained/84000000-0000-4000-8000-000000000011/original.jpg'::text)$$,
  'retained memory points to its private retained path'
);

select is_empty(
  $$select id from public.memories where id = '84000000-0000-4000-8000-000000000012'$$,
  'non-shared memory is deleted during finalization'
);

delete from auth.users where id = '84000000-0000-4000-8000-000000000001';

select results_eq(
  $$select added_by_display_name from public.shared_album_memories where memory_id = '84000000-0000-4000-8000-000000000011'$$,
  $$values ('退会する人'::text)$$,
  'the shared link survives Auth deletion with an adder snapshot'
);

select results_eq(
  $$select count(*)::bigint from public.memories where id = '84000000-0000-4000-8000-000000000011' and user_id is null$$,
  $$values (1::bigint)$$,
  'the retained memory survives Auth cascade without an owner id'
);

insert into storage.objects (bucket_id, name)
values ('memory-images', 'retained/84000000-0000-4000-8000-000000000011/original.jpg');

set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select caption from public.memories where id = '84000000-0000-4000-8000-000000000011'$$,
  $$values ('共有中の思い出'::text)$$,
  'a formal member can read the retained memory'
);

select results_eq(
  $$select name from storage.objects where name = 'retained/84000000-0000-4000-8000-000000000011/original.jpg'$$,
  $$values ('retained/84000000-0000-4000-8000-000000000011/original.jpg'::text)$$,
  'a formal member can read the retained image'
);

update public.memories set caption = '改変' where id = '84000000-0000-4000-8000-000000000011';
select results_eq(
  $$select caption from public.memories where id = '84000000-0000-4000-8000-000000000011'$$,
  $$values ('共有中の思い出'::text)$$,
  'a member cannot update a retained memory'
);

delete from storage.objects where name = 'retained/84000000-0000-4000-8000-000000000011/original.jpg';
select results_eq(
  $$select name from storage.objects where name = 'retained/84000000-0000-4000-8000-000000000011/original.jpg'$$,
  $$values ('retained/84000000-0000-4000-8000-000000000011/original.jpg'::text)$$,
  'a member cannot delete a retained image'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000003', true);

select is_empty(
  $$select id from public.memories where id = '84000000-0000-4000-8000-000000000011'$$,
  'a non-member cannot read the retained memory'
);

select is_empty(
  $$select name from storage.objects where name = 'retained/84000000-0000-4000-8000-000000000011/original.jpg'$$,
  'a non-member cannot read the retained image'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000002', true);
delete from public.shared_album_memories
where album_id = '84000000-0000-4000-8000-000000000021'
  and memory_id = '84000000-0000-4000-8000-000000000011';
reset role;

select results_eq(
  $$select memory_id from public.retained_memory_cleanup_queue$$,
  $$values ('84000000-0000-4000-8000-000000000011'::uuid)$$,
  'removing the last shared link queues retained cleanup immediately'
);

select results_eq(
  $$select count(*)::bigint from public.account_deletion_jobs where status = 'ready_for_auth'$$,
  $$values (1::bigint)$$,
  'the durable job remains available after Auth deletion'
);

select * from finish();
rollback;
