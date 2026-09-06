-- Keep shared quizzes synchronized while allowing custom question kinds and 3/5/10 second limits.

alter table public.shared_quiz_answers
  drop constraint if exists shared_quiz_answers_response_time;
alter table public.shared_quiz_answers
  add constraint shared_quiz_answers_response_time
  check (response_time_ms between 0 and 10000);

create or replace function public.join_shared_quiz(target_album_id uuid)
returns table (quiz_id uuid, quiz_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_quiz_id uuid;
  current_status text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  perform 1
    from public.shared_albums album
    where album.id = target_album_id
      and (select private.is_shared_album_member(album.id))
    for update;
  if not found then
    raise exception 'shared album membership not found' using errcode = '42501';
  end if;

  update public.shared_quizzes quiz
    set status = 'completed',
        completed_at = quiz.started_at
          + make_interval(secs => jsonb_array_length(quiz.questions)
            * coalesce((quiz.questions -> 0 ->> 'secondsPerQuestion')::integer, 5))
    where quiz.album_id = target_album_id
      and quiz.status = 'active'
      and quiz.started_at
        + make_interval(secs => jsonb_array_length(quiz.questions)
          * coalesce((quiz.questions -> 0 ->> 'secondsPerQuestion')::integer, 5))
        <= clock_timestamp();

  select quiz.id, quiz.status
    into current_quiz_id, current_status
    from public.shared_quizzes quiz
    where quiz.album_id = target_album_id
      and quiz.status in ('waiting', 'active')
    order by quiz.created_at desc, quiz.id desc
    limit 1
    for update;

  if current_quiz_id is null then
    insert into public.shared_quizzes (album_id, created_by)
      values (target_album_id, caller_id)
      returning id, status into current_quiz_id, current_status;
  elsif current_status = 'active' and not exists (
    select 1
      from public.shared_quiz_participants participant
      where participant.quiz_id = current_quiz_id
        and participant.user_id = caller_id
  ) then
    raise exception 'shared quiz has already started' using errcode = '55000';
  end if;

  insert into public.shared_quiz_participants (quiz_id, user_id)
    values (current_quiz_id, caller_id)
    on conflict on constraint shared_quiz_participants_pkey do nothing;

  quiz_id := current_quiz_id;
  quiz_status := current_status;
  return next;
end;
$$;

revoke all on function public.join_shared_quiz(uuid) from public, anon, authenticated;
grant execute on function public.join_shared_quiz(uuid) to authenticated;

create or replace function public.start_shared_quiz(
  target_quiz_id uuid,
  quiz_questions jsonb
)
returns table (quiz_status text, started_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_album_id uuid;
  current_status text;
  question jsonb;
  question_memory_id uuid;
  choice_value text;
  choice_id uuid;
  choice_count integer;
  distinct_choice_count integer;
  quiz_seconds integer;
  question_seconds integer;
  start_timestamp timestamptz;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select quiz.album_id, quiz.status
    into current_album_id, current_status
    from public.shared_quizzes quiz
    where quiz.id = target_quiz_id
    for update;
  if current_album_id is null or not (select private.is_shared_album_member(current_album_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  if not (select private.is_shared_album_owner(current_album_id)) then
    raise exception 'only the shared album owner can start a quiz' using errcode = '42501';
  end if;
  if current_status <> 'waiting' then
    raise exception 'shared quiz is not waiting' using errcode = '55000';
  end if;
  if not exists (
    select 1 from public.shared_quiz_participants participant
      where participant.quiz_id = target_quiz_id
        and participant.user_id = caller_id
  ) then
    raise exception 'shared quiz participant not found' using errcode = '42501';
  end if;

  if jsonb_typeof(quiz_questions) <> 'array' or jsonb_array_length(quiz_questions) <> 10 then
    raise exception 'shared quiz questions are invalid' using errcode = '22023';
  end if;

  for question in select value from jsonb_array_elements(quiz_questions)
  loop
    if jsonb_typeof(question) <> 'object'
      or question ->> 'kind' not in ('month', 'photo-to-caption', 'caption-to-photo')
      or jsonb_typeof(question -> 'choiceIds') <> 'array'
      or coalesce(question ->> 'secondsPerQuestion', '5') not in ('3', '5', '10')
    then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end if;

    question_seconds := coalesce((question ->> 'secondsPerQuestion')::integer, 5);
    if quiz_seconds is null then quiz_seconds := question_seconds; end if;
    if question_seconds <> quiz_seconds then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end if;

    begin
      question_memory_id := (question ->> 'memoryId')::uuid;
    exception when others then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end;

    if not exists (
      select 1
        from public.shared_album_memories album_memory
        where album_memory.album_id = current_album_id
          and album_memory.memory_id = question_memory_id
    ) then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end if;

    select count(*), count(distinct value)
      into choice_count, distinct_choice_count
      from jsonb_array_elements_text(question -> 'choiceIds');
    if choice_count not between 1 and 3
      or distinct_choice_count <> choice_count
      or not ((question -> 'choiceIds') ? question_memory_id::text)
    then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end if;

    for choice_value in select value from jsonb_array_elements_text(question -> 'choiceIds')
    loop
      begin
        choice_id := choice_value::uuid;
      exception when others then
        raise exception 'shared quiz questions are invalid' using errcode = '22023';
      end;
      if not exists (
        select 1
          from public.shared_album_memories album_memory
          where album_memory.album_id = current_album_id
            and album_memory.memory_id = choice_id
      ) then
        raise exception 'shared quiz questions are invalid' using errcode = '22023';
      end if;
    end loop;
  end loop;

  start_timestamp := clock_timestamp() + interval '5 seconds';
  update public.shared_quizzes quiz
    set status = 'active', questions = quiz_questions, started_at = start_timestamp
    where quiz.id = target_quiz_id;

  quiz_status := 'active';
  started_at := start_timestamp;
  return next;
end;
$$;

revoke all on function public.start_shared_quiz(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.start_shared_quiz(uuid, jsonb) to authenticated;

create or replace function public.submit_shared_quiz_answer(
  target_quiz_id uuid,
  target_question_index integer,
  target_selected_choice_id uuid
)
returns table (
  question_index integer,
  selected_choice_id uuid,
  is_correct boolean,
  response_time_ms integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  current_status text;
  quiz_questions jsonb;
  quiz_started_at timestamptz;
  question jsonb;
  question_started_at timestamptz;
  question_ends_at timestamptz;
  received_at timestamptz := clock_timestamp();
  answer_correct boolean;
  answer_time integer;
  quiz_seconds integer;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if target_question_index not between 0 and 9 then
    raise exception 'shared quiz question index is invalid' using errcode = '22023';
  end if;

  select quiz.status, quiz.questions, quiz.started_at
    into current_status, quiz_questions, quiz_started_at
    from public.shared_quizzes quiz
    where quiz.id = target_quiz_id;
  if current_status is null or not (select private.can_view_shared_quiz(target_quiz_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.shared_quiz_participants participant
      where participant.quiz_id = target_quiz_id
        and participant.user_id = caller_id
  ) then
    raise exception 'shared quiz participant not found' using errcode = '42501';
  end if;

  select answer.question_index, answer.selected_choice_id, answer.is_correct, answer.response_time_ms
    into question_index, selected_choice_id, is_correct, response_time_ms
    from public.shared_quiz_answers answer
    where answer.quiz_id = target_quiz_id
      and answer.user_id = caller_id
      and answer.question_index = target_question_index;
  if found then return next; return; end if;
  if current_status <> 'active' then
    raise exception 'shared quiz is not active' using errcode = '55000';
  end if;

  question := quiz_questions -> target_question_index;
  if question is null or not ((question -> 'choiceIds') ? target_selected_choice_id::text) then
    raise exception 'shared quiz answer is invalid' using errcode = '22023';
  end if;

  quiz_seconds := coalesce((question ->> 'secondsPerQuestion')::integer, 5);
  question_started_at := quiz_started_at + make_interval(secs => target_question_index * quiz_seconds);
  question_ends_at := question_started_at + make_interval(secs => quiz_seconds);
  if received_at < question_started_at then
    raise exception 'shared quiz question has not started' using errcode = '55000';
  end if;
  if received_at > question_ends_at then
    raise exception 'shared quiz question time expired' using errcode = '57014';
  end if;

  answer_time := least(quiz_seconds * 1000, greatest(0, floor(extract(epoch from (received_at - question_started_at)) * 1000)::integer));
  answer_correct := target_selected_choice_id::text = question ->> 'memoryId';

  insert into public.shared_quiz_answers (
    quiz_id, user_id, question_index, selected_choice_id, is_correct, response_time_ms, answered_at
  ) values (
    target_quiz_id, caller_id, target_question_index, target_selected_choice_id, answer_correct, answer_time, received_at
  ) on conflict on constraint shared_quiz_answers_pkey do nothing;

  select answer.question_index, answer.selected_choice_id, answer.is_correct, answer.response_time_ms
    into question_index, selected_choice_id, is_correct, response_time_ms
    from public.shared_quiz_answers answer
    where answer.quiz_id = target_quiz_id
      and answer.user_id = caller_id
      and answer.question_index = target_question_index;
  return next;
end;
$$;

revoke all on function public.submit_shared_quiz_answer(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.submit_shared_quiz_answer(uuid, integer, uuid) to authenticated;

create or replace function public.finalize_shared_quiz(target_quiz_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
  quiz_started_at timestamptz;
  quiz_questions jsonb;
  finish_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select quiz.status, quiz.started_at, quiz.questions
    into current_status, quiz_started_at, quiz_questions
    from public.shared_quizzes quiz
    where quiz.id = target_quiz_id
    for update;
  if current_status is null or not (select private.can_view_shared_quiz(target_quiz_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  if current_status = 'completed' then return 'completed'; end if;

  finish_timestamp := quiz_started_at
    + make_interval(secs => jsonb_array_length(quiz_questions)
      * coalesce((quiz_questions -> 0 ->> 'secondsPerQuestion')::integer, 5));
  if current_status <> 'active' or clock_timestamp() < finish_timestamp then
    raise exception 'shared quiz has not finished' using errcode = '55000';
  end if;

  update public.shared_quizzes quiz
    set status = 'completed', completed_at = finish_timestamp
    where quiz.id = target_quiz_id;
  return 'completed';
end;
$$;

revoke all on function public.finalize_shared_quiz(uuid) from public, anon, authenticated;
grant execute on function public.finalize_shared_quiz(uuid) to authenticated;
