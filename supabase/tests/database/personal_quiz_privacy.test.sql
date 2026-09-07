-- User-run only. These tests have NOT been executed by Codex.
begin;
select no_plan();
insert into auth.users(id,email,raw_user_meta_data) values
 ('93000000-0000-4000-8000-000000000001','quiz-privacy-owner@example.test','{"display_name":"出題本人"}'),
 ('93000000-0000-4000-8000-000000000002','quiz-privacy-outsider@example.test','{"display_name":"部外者"}');
insert into public.memories(id,user_id,image_path,caption,memory_date) values
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001/94000000-0000-4000-8000-000000000001.jpg','海辺の記録','2026-01-10'),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001/94000000-0000-4000-8000-000000000002.jpg','山の記録','2026-03-11'),
 ('94000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001/94000000-0000-4000-8000-000000000003.jpg','街の記録','2026-08-12');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
create temporary table quiz_privacy_cases(kind text primary key, dto jsonb);
insert into quiz_privacy_cases values
 ('photo-to-caption',public.start_personal_quiz('photo-to-caption',1)->'questions'->0),
 ('caption-to-photo',public.start_personal_quiz('caption-to-photo',1)->'questions'->0);
-- Use the actual generator; selecting month mode here is fixture setup, not a
-- publicly writable mode or caller-selected answer key.
insert into public.personal_quiz_sessions(id,user_id,mode) values
 ('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','quick');
do $$ declare v_dto jsonb; begin
 for i in 1..100 loop
  v_dto:=private.append_personal_question('95000000-0000-4000-8000-000000000001');
  if v_dto->>'kind'='month' then insert into quiz_privacy_cases values('month',v_dto); exit; end if;
 end loop;
end $$;
select is((select count(*) from quiz_privacy_cases),3::bigint,'cover all three question kinds');
select ok((select bool_and(dto->>'memoryId'='' and dto->'memory'->>'id'='' and dto->'memory'->>'caption'='' and dto->'memory'->>'date'='') from quiz_privacy_cases),'no pre-answer source ID, caption or date in memory metadata');
select ok((select bool_and(dto->>'correctChoiceId'='' and dto->>'correctLabel'='' and dto->'correct'='null'::jsonb and dto->'selectedChoiceId'='null'::jsonb) from quiz_privacy_cases),'answer key and grading are hidden');
select ok(not exists(select 1 from quiz_privacy_cases t join public.personal_quiz_questions q on q.id=(t.dto->>'id')::uuid where t.dto::text like '%'||q.memory_id::text||'%'),'source memory ID never appears in the public DTO');
select ok(not exists(select 1 from quiz_privacy_cases t cross join lateral jsonb_array_elements(t.dto->'choices') c where c ? 'memoryId' or c ? 'month' or c ? 'imagePath'),'choice mappings are never exposed');
select ok(not exists(select 1 from quiz_privacy_cases t cross join lateral jsonb_array_elements(t.dto->'choices') c join public.memories m on m.id::text=c->>'id'),'public choice IDs are not memory IDs');
select ok((select bool_and((c->>'id') ~ '^[0-9a-f-]{36}$') from quiz_privacy_cases t cross join lateral jsonb_array_elements(t.dto->'choices') c),'date choices also use opaque IDs');
select ok(not exists(select 1 from quiz_privacy_cases t cross join lateral jsonb_array_elements(t.dto->'choices') c where t.kind='caption-to-photo' and c ? 'label'),'photo choices do not leak captions');
select ok((select dto->'memory'->>'imageUrl'='' from quiz_privacy_cases where kind='caption-to-photo'),'target image is hidden for caption-to-photo');
select ok((select bool_and((dto->'memory'->>'imageUrl') like '/api/personal-quizzes/%/media') from quiz_privacy_cases where kind<>'caption-to-photo'),'prompt images use opaque authenticated media endpoints');
select ok((select bool_and((c->>'imageUrl') like '/api/personal-quizzes/%/media?choice=%') from quiz_privacy_cases t cross join lateral jsonb_array_elements(t.dto->'choices') c where t.kind='caption-to-photo'),'photo choices use question-scoped media endpoints');
select ok(not has_table_privilege('authenticated','public.personal_quiz_questions','SELECT'),'stored answer keys are not directly readable');
select ok(not has_table_privilege('authenticated','public.personal_quiz_questions','UPDATE'),'answers cannot be directly overwritten');
select ok(not has_function_privilege('authenticated','private.personal_question_json(public.personal_quiz_questions)','EXECUTE'),'raw projection helper cannot be called directly');
select ok(has_function_privilege('authenticated','public.get_personal_quiz_media_ref(uuid,text)','EXECUTE'),'authenticated clients can resolve only opaque media references');
select ok(not has_function_privilege('anon','public.answer_personal_quiz(uuid,text)','EXECUTE'),'anonymous grading is forbidden');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is(public.get_personal_quiz_media_ref((select (dto->>'id')::uuid from quiz_privacy_cases where kind='photo-to-caption'),null),null::text,'another user cannot resolve a question image');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is(public.get_personal_quiz_media_ref((select (dto->>'id')::uuid from quiz_privacy_cases where kind='caption-to-photo'),null),null::text,'caption question cannot fetch hidden target image');
select is(public.get_personal_quiz_media_ref((select (dto->>'id')::uuid from quiz_privacy_cases where kind='photo-to-caption'),(select dto->'choices'->0->>'id' from quiz_privacy_cases where kind='photo-to-caption')),null::text,'text choices cannot be resolved to images for target comparison');
select ok(public.get_personal_quiz_media_ref((select (dto->>'id')::uuid from quiz_privacy_cases where kind='caption-to-photo'),(select dto->'choices'->0->>'id' from quiz_privacy_cases where kind='caption-to-photo')) ~ '^[0-9a-f]{32}$','authorized photo choice resolves to an opaque reference, not a Storage path');
select throws_ok($$select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_privacy_cases where kind='photo-to-caption'),(select q.memory_id::text from public.personal_quiz_questions q join quiz_privacy_cases t on q.id=(t.dto->>'id')::uuid where t.kind='photo-to-caption'))$$,'22023','invalid choice','submitting source memory ID cannot answer the question');
select throws_ok($$select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_privacy_cases where kind='photo-to-caption'),(select dto->'choices'->0->>'id' from quiz_privacy_cases where kind='caption-to-photo'))$$,'22023','invalid choice','a choice token from another question cannot be reused');
select throws_ok($$select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_privacy_cases where kind='month'),(select to_char(m.memory_date,'YYYY-MM') from public.personal_quiz_questions q join public.memories m on m.id=q.memory_id join quiz_privacy_cases t on q.id=(t.dto->>'id')::uuid where t.kind='month'))$$,'22023','invalid choice','submitting the real month instead of an opaque choice ID is rejected');
select throws_ok($$select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_privacy_cases where kind='photo-to-caption'),null)$$,'22023','invalid choice','NULL cannot bypass answer validation');
create temporary table quiz_committed as
select public.answer_personal_quiz(q.id,q.correct_choice_id) as dto from public.personal_quiz_questions q join quiz_privacy_cases t on q.id=(t.dto->>'id')::uuid where t.kind='photo-to-caption';
select ok((select (dto->>'correct')::boolean and dto->>'memoryId'<>'' and dto->>'correctChoiceId'<>'' from quiz_committed),'confirmed answer reveals authoritative result and memory');
select is((select c.value from public.profile_activity_counters c where c.user_id='93000000-0000-4000-8000-000000000001' and c.metric='correctQuizAnswers'),1::bigint,'one correct answer adds one');
select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_committed),(select dto->>'correctChoiceId' from quiz_committed));
select is((select c.value from public.profile_activity_counters c where c.user_id='93000000-0000-4000-8000-000000000001' and c.metric='correctQuizAnswers'),1::bigint,'answer replay is idempotent');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.answer_personal_quiz((select (dto->>'id')::uuid from quiz_committed),(select dto->>'correctChoiceId' from quiz_committed))$$,'42501','quiz not found','outsider cannot retrieve a committed answer');
select set_config('request.jwt.claims','{"sub":"93000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Simulate a backfilled historical total before activating level 18. Runtime
-- letter saves must increment the first new event relative to this baseline.
update public.profile_progress set achieved_level=17 where user_id='93000000-0000-4000-8000-000000000001';
insert into public.profile_activity_counters(user_id,metric,value) values('93000000-0000-4000-8000-000000000001','savedAlbumLetters',7);
select private.evaluate_profile('93000000-0000-4000-8000-000000000001');
select is((select value from public.profile_level_baselines where user_id='93000000-0000-4000-8000-000000000001' and target_level=18),7::bigint,'historical letters are baseline, not new condition progress');
select ok(not exists(select 1 from information_schema.columns where table_schema='public' and table_name='memories' and column_name='letter_save_id'),'there is no client-controlled letter event ID column');
select throws_ok($$select public.record_profile_client_event('savedAlbumLetters',gen_random_uuid()::text)$$,'22023','invalid event','client event endpoint cannot award letter saves');
set local role authenticated;
select throws_ok($$update public.memories set letter_save_id=gen_random_uuid() where id='94000000-0000-4000-8000-000000000001'$$,'42703',null,'forged event ID update is rejected');
update public.memories set letter='新しい手紙' where id='94000000-0000-4000-8000-000000000001';
reset role;
select is((select value from public.profile_activity_counters where user_id='93000000-0000-4000-8000-000000000001' and metric='savedAlbumLetters'),8::bigint,'first real content save counts immediately');
select is((select value from public.profile_level_baselines where user_id='93000000-0000-4000-8000-000000000001' and target_level=18),7::bigint,'first success is not swallowed by baseline initialization');
set local role authenticated;
update public.memories set letter='新しい手紙' where id='94000000-0000-4000-8000-000000000001';
update public.memories set letter='  新しい手紙  ' where id='94000000-0000-4000-8000-000000000001';
update public.memories set caption='本文以外の更新' where id='94000000-0000-4000-8000-000000000001';
reset role;
select is((select value from public.profile_activity_counters where user_id='93000000-0000-4000-8000-000000000001' and metric='savedAlbumLetters'),8::bigint,'same text, whitespace-only and unrelated updates do not count');
set local role authenticated;
select throws_ok($$update public.memories set letter=repeat('字',401) where id='94000000-0000-4000-8000-000000000001'$$,'23514',null,'failed content validation does not save');
reset role;
select is((select value from public.profile_activity_counters where user_id='93000000-0000-4000-8000-000000000001' and metric='savedAlbumLetters'),8::bigint,'failed save adds no event');
set local role authenticated;
update public.memories set letter='' where id='94000000-0000-4000-8000-000000000001';
update public.memories set letter='変更した手紙' where id='94000000-0000-4000-8000-000000000001';
reset role;
select is((select value from public.profile_activity_counters where user_id='93000000-0000-4000-8000-000000000001' and metric='savedAlbumLetters'),9::bigint,'clearing does not count, different nonempty content does');
select is((select count(*) from public.profile_activity_events where user_id='93000000-0000-4000-8000-000000000001' and event_type='letter-saved'),2::bigint,'only two real saves produced server-generated events');
select ok((select bool_and(source_event_id ~ '^[0-9a-f-]{36}$') from public.profile_activity_events where user_id='93000000-0000-4000-8000-000000000001' and event_type='letter-saved'),'letter event identifiers are server UUIDs');
select * from finish();
rollback;
