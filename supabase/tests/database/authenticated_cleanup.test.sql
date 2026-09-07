-- USER-RUN ONLY. Requires migrations through 070300 and pgTAP.
-- These SQL assertions do not replace the Storage HTTP/concurrency checklist.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('98000000-0000-4000-8000-000000000001','cleanup-owner@example.test','{"display_name":"オーナー"}'),
 ('98000000-0000-4000-8000-000000000002','cleanup-other@example.test','{"display_name":"別ユーザー"}');
insert into public.shared_albums(id,owner_id,name) values
 ('98100000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','グループ1'),
 ('98100000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000001','グループ2');
insert into public.memories(id,user_id,image_path,thumbnail_path,caption,memory_date) values
 ('98200000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001/a.webp',null,'保持する写真','2026-09-01'),
 ('98200000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001/b.webp',null,'本人の写真','2026-09-01'),
 ('98200000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001/c.webp',null,'管理者回収','2026-09-01');
insert into public.shared_album_memories(album_id,memory_id,added_by) values
 ('98100000-0000-4000-8000-000000000001','98200000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001'),
 ('98100000-0000-4000-8000-000000000002','98200000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001'),
 ('98100000-0000-4000-8000-000000000001','98200000-0000-4000-8000-000000000002','98000000-0000-4000-8000-000000000001'),
 ('98100000-0000-4000-8000-000000000001','98200000-0000-4000-8000-000000000003','98000000-0000-4000-8000-000000000001');
update public.memories set user_id=null,retained_at=now(),retained_owner_name='退会済み',
 image_path='retained/'||id::text||'/original.webp',thumbnail_path='retained/'||id::text||'/thumbnails/preview.webp'
 where id in ('98200000-0000-4000-8000-000000000001','98200000-0000-4000-8000-000000000003');
insert into storage.objects(bucket_id,name) values
 ('memory-images','retained/98200000-0000-4000-8000-000000000001/original.webp'),
 ('memory-images','retained/98200000-0000-4000-8000-000000000001/thumbnails/preview.webp');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
delete from public.shared_album_memories where memory_id='98200000-0000-4000-8000-000000000003';
select is((select count(*) from public.authenticated_storage_cleanup),0::bigint,'NULL auth.uid creates no user receipt');
select is((select count(*) from public.retained_memory_cleanup_queue where memory_id='98200000-0000-4000-8000-000000000003'),1::bigint,'original global queue trigger still runs');
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
delete from public.shared_album_memories where album_id='98100000-0000-4000-8000-000000000001';
select is((select count(*) from public.claim_authenticated_storage_cleanup()),0::bigint,'another group still shares the photo: no claim');
select ok(not private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/original.webp'),'unclaimed receipt never permits deletion');
reset role;
select is((select count(*) from public.authenticated_storage_cleanup where memory_id='98200000-0000-4000-8000-000000000002'),0::bigint,'owned memory never becomes a cleanup target');
set local role authenticated;
delete from public.shared_albums where id='98100000-0000-4000-8000-000000000002';
create temporary table cleanup_claim as select * from public.claim_authenticated_storage_cleanup();
select is((select count(*) from cleanup_claim),1::bigint,'group deletion permits scoped cleanup even after membership disappears');
select is((select count(*) from public.claim_authenticated_storage_cleanup()),0::bigint,'live lease cannot be claimed twice');
select ok(private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/original.webp'),'live receipt and orphan retained state permit exact original');
select ok(private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/thumbnails/preview.webp'),'exact current thumbnail is permitted');
select ok(not private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/other.webp'),'arbitrary sibling path is denied');
select ok(not private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000003/original.webp'),'global queue alone confers no user permission');
select ok(not public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),gen_random_uuid()),'forged lease cannot finish');
with removed as (delete from storage.objects where bucket_id='memory-images' and name='retained/98200000-0000-4000-8000-000000000001/original.webp' returning id)
select is((select count(*) from removed),1::bigint,'authenticated Storage RLS permits deletion only with current receipt/lease/state');
select ok(not public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),(select lease_token from cleanup_claim)),'Storage still exists: success cannot be asserted by caller');
reset role;
select is((select count(*) from public.retained_memory_cleanup_queue where memory_id='98200000-0000-4000-8000-000000000001'),1::bigint,'failed finish preserves global queue');
select is((select count(*) from public.memories where id='98200000-0000-4000-8000-000000000001'),1::bigint,'failed finish preserves memory');
update public.authenticated_storage_cleanup set retry_after=clock_timestamp()-interval '1 minute';
set local role authenticated;
truncate cleanup_claim;
insert into cleanup_claim select * from public.claim_authenticated_storage_cleanup();
reset role;
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.claim_authenticated_storage_cleanup()),0::bigint,'another user cannot claim receipts');
select ok(not private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/original.webp'),'another user cannot delete even with a live receipt');
reset role;
select set_config('request.jwt.claims','{"sub":"98000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Simulate a stale lease. Runtime never accepts client timestamps.
update public.authenticated_storage_cleanup set lease_until=clock_timestamp()-interval '1 second';
set local role authenticated;
select ok(not private.can_delete_authenticated_cleanup_object('memory-images','retained/98200000-0000-4000-8000-000000000001/original.webp'),'Storage predicate rechecks lease at deletion time');
with removed as (delete from storage.objects where bucket_id='memory-images' and name='retained/98200000-0000-4000-8000-000000000001/thumbnails/preview.webp' returning id)
select is((select count(*) from removed),0::bigint,'expired lease also prevents actual Storage row DELETE');
reset role;
update public.authenticated_storage_cleanup set retry_after=clock_timestamp()-interval '1 minute';
set local role authenticated;
truncate cleanup_claim;
insert into cleanup_claim select * from public.claim_authenticated_storage_cleanup();
reset role;
-- SQL fixture removal models Storage absence; actual API deletion is user-tested.
delete from storage.objects where bucket_id='memory-images' and name like 'retained/98200000-0000-4000-8000-000000000001/%';
set local role authenticated;
select ok(public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),(select lease_token from cleanup_claim)),'DB-confirmed absence finishes cleanup');
select ok(not public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),(select lease_token from cleanup_claim)),'repeat finish makes no further deletion');
select ok(not has_table_privilege('authenticated','public.authenticated_storage_cleanup','INSERT'),'clients cannot fabricate receipts');
select ok(not has_function_privilege('authenticated','public.retained_cleanup_paths(uuid)','EXECUTE'),'global cleanup remains service-only');
reset role;
select is((select count(*) from public.memories where id='98200000-0000-4000-8000-000000000001'),0::bigint,'retained memory removed');
select is((select count(*) from public.authenticated_storage_cleanup where memory_id='98200000-0000-4000-8000-000000000001'),0::bigint,'user receipts removed');
select is((select count(*) from public.retained_memory_cleanup_queue where memory_id='98200000-0000-4000-8000-000000000001'),0::bigint,'matching global row removed only on success');
select is((select count(*) from public.memories where id='98200000-0000-4000-8000-000000000002'),1::bigint,'original owned memory survives');
-- Existing icon controls: replacement and deletion without service-role Storage.
set local role authenticated;
create temporary table icon_paths(label text,path text);
insert into icon_paths values('old',public.reserve_group_icon('98100000-0000-4000-8000-000000000001'));
insert into storage.objects(bucket_id,name) select 'shared-group-icons',path from icon_paths where label='old';
select public.commit_group_icon('98100000-0000-4000-8000-000000000001',(select path from icon_paths where label='old'));
insert into icon_paths values('new',public.reserve_group_icon('98100000-0000-4000-8000-000000000001'));
insert into storage.objects(bucket_id,name) select 'shared-group-icons',path from icon_paths where label='new';
select public.commit_group_icon('98100000-0000-4000-8000-000000000001',(select path from icon_paths where label='new'));
truncate cleanup_claim;
insert into cleanup_claim select * from public.claim_authenticated_storage_cleanup();
select is((select count(*) from cleanup_claim),1::bigint,'replacement grants cleanup only for retired icon');
with removed as (delete from storage.objects where bucket_id='shared-group-icons' and name=(select path from icon_paths where label='new') returning id)
select is((select count(*) from removed),0::bigint,'currently used icon cannot be deleted');
with removed as (delete from storage.objects where bucket_id='shared-group-icons' and name=(select path from icon_paths where label='old') returning id)
select is((select count(*) from removed),1::bigint,'retired icon can be deleted by its reservation owner');
select ok(public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),(select lease_token from cleanup_claim)),'retired icon completion is confirmed by DB');
delete from public.shared_albums where id='98100000-0000-4000-8000-000000000001';
truncate cleanup_claim;
insert into cleanup_claim select * from public.claim_authenticated_storage_cleanup();
select is((select count(*) from cleanup_claim),1::bigint,'deleted group icon remains eligible for recorded owner');
with removed as (delete from storage.objects where bucket_id='shared-group-icons' and name=(select path from icon_paths where label='new') returning id)
select is((select count(*) from removed),1::bigint,'group deletion removes only now-unreferenced icon');
select ok(public.finish_authenticated_storage_cleanup((select operation_id from cleanup_claim),(select lease_token from cleanup_claim)),'deleted group icon receipt is completed');
reset role;
select * from finish();
rollback;
