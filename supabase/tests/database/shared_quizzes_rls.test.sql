begin;

select plan(20);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('71000000-0000-4000-8000-000000000001', 'quiz-owner@example.com', '{"display_name":"クイズオーナー"}'),
  ('72000000-0000-4000-8000-000000000002', 'quiz-member@example.com', '{"display_name":"クイズメンバー"}'),
  ('73000000-0000-4000-8000-000000000003', 'quiz-outsider@example.com', '{"display_name":"部外者"}');

insert into public.memories (id, user_id, image_path, caption, memory_date)
values
  ('74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'quiz/one.jpg', '一枚目', '2026-09-01'),
  ('74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', 'quiz/two.jpg', '二枚目', '2026-09-02'),
  ('74000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001', 'quiz/three.jpg', '三枚目', '2026-09-03');

insert into public.shared_albums (id, owner_id, name)
values
  ('75000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 'クイズ確認グループ'),
  ('75000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001', '一人クイズ確認グループ');

insert into public.shared_album_members (album_id, user_id, role)
values ('75000000-0000-4000-8000-000000000001', '72000000-0000-4000-8000-000000000002', 'member');

insert into public.shared_album_memories (album_id, memory_id, added_by)
values
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000001'),
  ('75000000-0000-4000-8000-000000000002', '74000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000001');

create temporary table quiz_fixture (id uuid primary key);
create temporary table solo_quiz_fixture (id uuid primary key);
create temporary table quiz_plan (questions jsonb not null);
grant select, insert on table pg_temp.quiz_fixture to authenticated;
grant select, insert on table pg_temp.solo_quiz_fixture to authenticated;
grant select on table pg_temp.quiz_plan to authenticated;

insert into quiz_plan (questions)
select jsonb_agg(jsonb_build_object(
  'memoryId', case (question_number - 1) % 3
    when 0 then '74000000-0000-4000-8000-000000000001'
    when 1 then '74000000-0000-4000-8000-000000000002'
    else '74000000-0000-4000-8000-000000000003'
  end,
  'kind', case when question_number <= 5 then 'photo-to-caption' else 'caption-to-photo' end,
  'choiceIds', jsonb_build_array(
    '74000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000002',
    '74000000-0000-4000-8000-000000000003'
  )
) order by question_number)
from generate_series(1, 10) question_number;

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

insert into pg_temp.quiz_fixture (id)
select quiz_id from public.join_shared_quiz('75000000-0000-4000-8000-000000000001');

select results_eq(
  $$select status from public.shared_quizzes where id = (select id from pg_temp.quiz_fixture)$$,
  $$values ('waiting'::text)$$,
  'the first group member creates a waiting quiz'
);

select results_eq(
  $$select count(*) from public.shared_quiz_participants where quiz_id = (select id from pg_temp.quiz_fixture)$$,
  $$values (1::bigint)$$,
  'one participant is sufficient for the lobby'
);

insert into pg_temp.solo_quiz_fixture (id)
select quiz_id from public.join_shared_quiz('75000000-0000-4000-8000-000000000002');

select results_eq(
  $$select quiz_status from public.start_shared_quiz(
    (select id from pg_temp.solo_quiz_fixture),
    (select questions from pg_temp.quiz_plan)
  )$$,
  $$values ('active'::text)$$,
  'one participant can start without waiting for anyone else'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select quiz_id from public.join_shared_quiz('75000000-0000-4000-8000-000000000001')$$,
  $$select id from pg_temp.quiz_fixture$$,
  'another member joins the same waiting quiz'
);

select results_eq(
  $$select count(*) from public.shared_quiz_participants where quiz_id = (select id from pg_temp.quiz_fixture)$$,
  $$values (2::bigint)$$,
  'the lobby keeps both participants'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000003', true);

select throws_ok(
  $$select public.join_shared_quiz('75000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'a non-member cannot join a group quiz'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select quiz_status from public.start_shared_quiz(
    (select id from pg_temp.quiz_fixture),
    (select questions from pg_temp.quiz_plan)
  )$$,
  $$values ('active'::text)$$,
  'a joined participant can start the multiplayer quiz'
);

select results_eq(
  $$select jsonb_array_length(questions) from public.shared_quizzes where id = (select id from pg_temp.quiz_fixture)$$,
  $$values (10)$$,
  'the started quiz stores exactly ten questions'
);

select results_eq(
  $$select count(*) from jsonb_array_elements(
    (select questions from public.shared_quizzes where id = (select id from pg_temp.quiz_fixture))
  ) item where item ->> 'kind' = 'photo-to-caption'$$,
  $$values (5::bigint)$$,
  'five questions ask for the caption'
);

select results_eq(
  $$select count(*) from jsonb_array_elements(
    (select questions from public.shared_quizzes where id = (select id from pg_temp.quiz_fixture))
  ) item where item ->> 'kind' = 'caption-to-photo'$$,
  $$values (5::bigint)$$,
  'five questions ask for the photo'
);

select throws_ok(
  $$select public.submit_shared_quiz_answer(
    (select id from pg_temp.quiz_fixture), 0, '74000000-0000-4000-8000-000000000001'
  )$$,
  '55000',
  null,
  'answers are rejected during the start countdown'
);

reset role;
update public.shared_quizzes set started_at = clock_timestamp() - interval '1 second'
where id = (select id from quiz_fixture);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select is_correct from public.submit_shared_quiz_answer(
    (select id from pg_temp.quiz_fixture), 0, '74000000-0000-4000-8000-000000000001'
  )$$,
  $$values (true)$$,
  'the server accepts a correct answer inside its five-second window'
);

select results_eq(
  $$select is_correct from public.submit_shared_quiz_answer(
    (select id from pg_temp.quiz_fixture), 0, '74000000-0000-4000-8000-000000000002'
  )$$,
  $$values (true)$$,
  'only the first answer for a participant and question is scored'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);

select results_eq(
  $$select is_correct from public.submit_shared_quiz_answer(
    (select id from pg_temp.quiz_fixture), 0, '74000000-0000-4000-8000-000000000002'
  )$$,
  $$values (false)$$,
  'another participant receives an independent score'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-4000-8000-000000000003', true);

select throws_ok(
  $$select public.submit_shared_quiz_answer(
    (select id from pg_temp.quiz_fixture), 0, '74000000-0000-4000-8000-000000000001'
  )$$,
  'P0002',
  null,
  'an outsider cannot submit an answer'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.finalize_shared_quiz((select id from pg_temp.quiz_fixture))$$,
  '55000',
  null,
  'the quiz cannot be finalized before all ten five-second windows end'
);

reset role;
update public.shared_quizzes set started_at = clock_timestamp() - interval '51 seconds'
where id = (select id from quiz_fixture);

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', true);

select results_eq(
  $$select public.finalize_shared_quiz((select id from pg_temp.quiz_fixture))$$,
  $$values ('completed'::text)$$,
  'the quiz finalizes after fifty seconds'
);

select results_eq(
  $$select user_id from public.list_shared_quiz_standings((select id from pg_temp.quiz_fixture)) order by rank$$,
  $$values
    ('71000000-0000-4000-8000-000000000001'::uuid),
    ('72000000-0000-4000-8000-000000000002'::uuid)$$,
  'correct-answer count has priority in the standings'
);

select results_eq(
  $$select rank from public.list_shared_quiz_standings((select id from pg_temp.quiz_fixture)) order by rank$$,
  $$values (1::bigint), (2::bigint)$$,
  'row-number ranking never returns a tied place'
);

select throws_ok(
  $$insert into public.shared_quizzes (album_id)
    values ('75000000-0000-4000-8000-000000000001')$$,
  '42501',
  null,
  'authenticated clients cannot bypass the quiz RPCs with direct writes'
);

select * from finish();
rollback;
