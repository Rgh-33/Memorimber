-- User-run transactional acceptance checks. Never executed by Codex.
begin;
select plan(24);
insert into auth.users(id,email,raw_user_meta_data) values
 ('91000000-0000-4000-8000-000000000001','progress-owner@example.test','{"display_name":"記録本人"}'),
 ('91000000-0000-4000-8000-000000000002','progress-member@example.test','{"display_name":"記録メンバー"}'),
 ('91000000-0000-4000-8000-000000000003','progress-outsider@example.test','{"display_name":"部外者"}');
with ids as (select gen_random_uuid() as id from generate_series(1,120))
insert into public.memories(id,user_id,image_path,caption,memory_date)
 select id,'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001/'||id::text||'.jpg','記録','2026-09-01' from ids;
select is((select achieved_level::integer from public.profile_progress where user_id='91000000-0000-4000-8000-000000000001'),9,'photos alone stop at level 9');
-- Simulate a historical aggregate before activating a condition: no live replay.
insert into public.profile_activity_counters(user_id,metric,value) values('91000000-0000-4000-8000-000000000001','harvestedFruits',20);
update public.profile_level_baselines set value=20 where user_id='91000000-0000-4000-8000-000000000001' and target_level=10;
select private.evaluate_profile('91000000-0000-4000-8000-000000000001');
select is((select achieved_level::integer from public.profile_progress where user_id='91000000-0000-4000-8000-000000000001'),9,'historical twenty harvests do not meet a newly active condition');
select private.record_profile_event('91000000-0000-4000-8000-000000000001','fixture','first','{"harvestedFruits":1}');
select is((select value from public.profile_activity_counters where user_id='91000000-0000-4000-8000-000000000001' and metric='harvestedFruits'),21::bigint,'first new event is counted');
select private.record_profile_event('91000000-0000-4000-8000-000000000001','fixture','first','{"harvestedFruits":1}');
select is((select value from public.profile_activity_counters where user_id='91000000-0000-4000-8000-000000000001' and metric='harvestedFruits'),21::bigint,'retry is idempotent');
select private.record_profile_event('91000000-0000-4000-8000-000000000001','fixture',i::text,'{"harvestedFruits":1}') from generate_series(2,5) i;
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'achievedLevel')::integer,10,'five new harvests advance to ten');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'photosIntoLevel')::integer,32,'overflow is 32/15');
delete from public.memories where id in(select m.id from public.memories m where m.user_id='91000000-0000-4000-8000-000000000001' order by m.id limit 33);
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'achievedLevel')::integer,10,'deletion never lowers achieved level');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'photosIntoLevel')::integer,-1,'negative progress is -1/15');
select private.record_profile_event('91000000-0000-4000-8000-000000000001','fixture','random','{"randomQuizChallenges":1}');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'achievedLevel')::integer,10,'activity advances while photos remain insufficient');
with ids as(select gen_random_uuid() as id from generate_series(1,33))
insert into public.memories(id,user_id,image_path,caption,memory_date)
 select id,'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001/'||id::text||'.jpg','再追加','2026-09-01' from ids;
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'achievedLevel')::integer,11,'stored activity unlocks promotion after photo recovery');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->>'photosIntoLevel')::integer,17,'promotion carries 17/15');
select is((select value from public.profile_level_baselines where user_id='91000000-0000-4000-8000-000000000001' and target_level=12),25::bigint,'new harvest condition excludes all prior harvests');
insert into public.shared_albums(id,owner_id,name) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','記録A'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','記録B');
insert into public.shared_album_members(album_id,user_id,role) values
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','member'),
 ('92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','member');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->'stats'->>'connectedPeople')::integer,1,'connections exclude self and deduplicate across groups');
insert into public.shared_album_memories(album_id,memory_id,added_by)
 select '92000000-0000-4000-8000-000000000001',m.id,'91000000-0000-4000-8000-000000000001' from public.memories m where m.user_id='91000000-0000-4000-8000-000000000001' order by m.id limit 3;
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->'stats'->>'sharedMemories')::integer,3,'three-row sharing adds three');
select is((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->'stats'->>'sharedMemories')::integer,3,'read does not count sharing again');
select is(public.server_group_profiles('91000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),null::jsonb,'outsider cannot read group profile');
select is(public.server_group_profiles('91000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003'),null::jsonb,'outside target is indistinguishable from absent target');
select ok(not has_table_privilege('authenticated','public.profile_activity_counters','INSERT'),'clients cannot increment counters');
select ok(not has_function_privilege('authenticated','private.record_profile_event(uuid,text,text,jsonb,timestamptz,boolean)','EXECUTE'),'internal event writer is inaccessible');
select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.update_group_presentation('92000000-0000-4000-8000-000000000001','{"quizMonthCount":1}')$$,'23514',null,'custom total other than ten is rejected');
select throws_ok($$select public.update_group_presentation('92000000-0000-4000-8000-000000000001','{"quizSecondsPerQuestion":4}')$$,'23514',null,'invalid seconds rejected');
select throws_ok($$select public.update_group_presentation('92000000-0000-4000-8000-000000000001','{"showDate":null}')$$,'22023',null,'null cannot bypass settings validation');
create temporary table solo_progress_quiz as select quiz_id from public.join_shared_quiz('92000000-0000-4000-8000-000000000001');
select * from public.start_shared_quiz((select quiz_id from solo_progress_quiz),null);
update public.shared_quizzes set started_at=clock_timestamp()-interval '1 minute' where id=(select quiz_id from solo_progress_quiz);
select public.finalize_shared_quiz((select quiz_id from solo_progress_quiz));
select is(coalesce((private.profile_snapshot('91000000-0000-4000-8000-000000000001')->'stats'->>'sharedQuizWins')::integer,0),0,'solo completion does not award first place');
select public.finalize_shared_quiz((select quiz_id from solo_progress_quiz));
select is((select count(*) from public.profile_activity_events where user_id='91000000-0000-4000-8000-000000000001' and event_type='shared-start' and source_event_id=(select quiz_id::text from solo_progress_quiz)),1::bigint,'re-finalizing cannot count a session twice');
select * from finish();
rollback;
