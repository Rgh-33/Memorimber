-- User-run only; no migration/DB/browser execution was performed by Codex.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('96000000-0000-4000-8000-000000000001','share-auth-owner@example.test','{"display_name":"本人"}'),
 ('96000000-0000-4000-8000-000000000002','share-auth-member@example.test','{"display_name":"メンバー"}'),
 ('96000000-0000-4000-8000-000000000003','share-auth-outsider@example.test','{"display_name":"部外者"}');
insert into public.shared_albums(id,owner_id,name) values ('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','通常クライアント');
insert into public.shared_album_members(album_id,user_id,role) values ('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002','member');
update public.profiles set avatar_url='96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000001.webp' where id='96000000-0000-4000-8000-000000000002';
insert into storage.objects(bucket_id,name) values
 ('profile-avatars','96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000001.webp'),
 ('profile-avatars','96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000002.webp');
select set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(jsonb_array_length(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001')),2,'ordinary authenticated role can load current members');
select is((select count(*) from public.profiles where id='96000000-0000-4000-8000-000000000002'),0::bigint,'profiles SELECT is not widened');
select ok(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001')::text not like '%avatarPath%','RPC exposes no raw avatar path field');
select ok(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001')::text not like '%/avatar-98000000%','raw Storage path is absent even on direct RPC invocation');
select ok(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001')::text not like '%savedAlbumLetters%','only display records are exposed');
select is((public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001')->0->>'canEdit')::boolean,false,'self viewed through group is not editable');
select is((select count(*) from storage.objects where bucket_id='profile-avatars' and name like '96000000-0000-4000-8000-000000000002/%'),1::bigint,'only currently referenced member avatar is readable');
select ok(not private.can_read_shared_profile_avatar('96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000002.webp'),'obsolete avatar is not readable by co-members');
select is(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000003'),null::jsonb,'outside target returns null');
select is(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000099'),null::jsonb,'nonexistent target has the same result');
select ok(not has_function_privilege('anon','public.get_shared_group_profiles(uuid,uuid)','EXECUTE'),'anonymous callers cannot execute profile RPC');
select ok(to_regprocedure('public.server_group_profiles(uuid,uuid,uuid)') is null,'caller-spoofable service-only rendering RPC is retired');
with changed as (update storage.objects set metadata='{"changed":true}' where bucket_id='profile-avatars' and name='96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000001.webp' returning id)
select is((select count(*) from changed),0::bigint,'co-member cannot update another avatar');
with removed as (delete from storage.objects where bucket_id='profile-avatars' and name='96000000-0000-4000-8000-000000000002/avatar-98000000-0000-4000-8000-000000000001.webp' returning id)
select is((select count(*) from removed),0::bigint,'co-member cannot delete another avatar');
reset role;
select set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001'),null::jsonb,'caller identity comes from auth.uid and rejects outsider');
select is(public.get_shared_group_avatar_ref('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002'),null::text,'outside caller cannot obtain avatar ref');
select is((select count(*) from storage.objects where bucket_id='profile-avatars' and name like '96000000-0000-4000-8000-000000000002/%'),0::bigint,'outsider cannot read avatar via Storage');
reset role;
delete from public.shared_album_members where album_id='97000000-0000-4000-8000-000000000001' and user_id='96000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"96000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is(public.get_shared_group_profiles('97000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000002'),null::jsonb,'departed target is hidden');
select is((select count(*) from storage.objects where bucket_id='profile-avatars' and name like '96000000-0000-4000-8000-000000000002/%'),0::bigint,'avatar access disappears with membership');
reset role;
select * from finish();
rollback;
