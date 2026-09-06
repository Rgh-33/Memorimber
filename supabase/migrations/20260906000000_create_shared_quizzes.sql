-- Synchronized ten-question quizzes for shared groups. The database owns the
-- lobby, authoritative five-second clock, first answer, and final ranking.
create table public.shared_quizzes (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.shared_albums (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'waiting',
  questions jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shared_quizzes_status check (status in ('waiting', 'active', 'completed')),
  constraint shared_quizzes_questions_array check (jsonb_typeof(questions) = 'array'),
  constraint shared_quizzes_timestamps check (
    (status = 'waiting' and started_at is null and completed_at is null)
    or (status = 'active' and started_at is not null and completed_at is null)
    or (status = 'completed' and started_at is not null and completed_at is not null)
  )
);

create unique index shared_quizzes_one_current_per_album_idx
  on public.shared_quizzes (album_id)
  where status in ('waiting', 'active');

create index shared_quizzes_album_history_idx
  on public.shared_quizzes (album_id, created_at desc);

create table public.shared_quiz_participants (
  quiz_id uuid not null references public.shared_quizzes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (quiz_id, user_id)
);

create index shared_quiz_participants_user_idx
  on public.shared_quiz_participants (user_id, quiz_id);

create table public.shared_quiz_answers (
  quiz_id uuid not null,
  user_id uuid not null,
  question_index integer not null,
  selected_choice_id uuid not null,
  is_correct boolean not null,
  response_time_ms integer not null,
  answered_at timestamptz not null default now(),
  primary key (quiz_id, user_id, question_index),
  constraint shared_quiz_answers_participant_fkey
    foreign key (quiz_id, user_id)
    references public.shared_quiz_participants (quiz_id, user_id)
    on delete cascade,
  constraint shared_quiz_answers_question_index check (question_index between 0 and 9),
  constraint shared_quiz_answers_response_time check (response_time_ms between 0 and 5000)
);

create index shared_quiz_answers_score_idx
  on public.shared_quiz_answers (quiz_id, user_id, is_correct);

comment on table public.shared_quizzes is 'One synchronized 10-question competition inside a shared group';
comment on table public.shared_quiz_participants is 'Group members who joined a shared quiz before it started';
comment on table public.shared_quiz_answers is 'First server-timed answer per participant and question';

create or replace function private.can_view_shared_quiz(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.shared_quizzes quiz
      join public.shared_album_members membership
        on membership.album_id = quiz.album_id
      where quiz.id = target_quiz_id
        and membership.user_id = (select auth.uid())
  );
$$;

revoke all on function private.can_view_shared_quiz(uuid) from public, anon, authenticated;
grant execute on function private.can_view_shared_quiz(uuid) to authenticated;

alter table public.shared_quizzes enable row level security;
alter table public.shared_quiz_participants enable row level security;
alter table public.shared_quiz_answers enable row level security;

create policy "Group members can view shared quizzes"
  on public.shared_quizzes
  for select
  to authenticated
  using ((select private.is_shared_album_member(album_id)));

create policy "Group members can view shared quiz participants"
  on public.shared_quiz_participants
  for select
  to authenticated
  using ((select private.can_view_shared_quiz(quiz_id)));

create policy "Participants can view their own shared quiz answers"
  on public.shared_quiz_answers
  for select
  to authenticated
  using (user_id = (select auth.uid()) and (select private.can_view_shared_quiz(quiz_id)));

revoke all on table public.shared_quizzes from anon, authenticated;
revoke all on table public.shared_quiz_participants from anon, authenticated;
revoke all on table public.shared_quiz_answers from anon, authenticated;
grant select on table public.shared_quizzes to authenticated;
grant select on table public.shared_quiz_participants to authenticated;
grant select on table public.shared_quiz_answers to authenticated;

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
        completed_at = quiz.started_at + interval '50 seconds'
    where quiz.album_id = target_album_id
      and quiz.status = 'active'
      and quiz.started_at + interval '50 seconds' <= clock_timestamp();

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
  photo_to_caption_count integer;
  caption_to_photo_count integer;
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

  select
    count(*) filter (where item ->> 'kind' = 'photo-to-caption'),
    count(*) filter (where item ->> 'kind' = 'caption-to-photo')
    into photo_to_caption_count, caption_to_photo_count
    from jsonb_array_elements(quiz_questions) item;
  if photo_to_caption_count <> 5 or caption_to_photo_count <> 5 then
    raise exception 'shared quiz questions are invalid' using errcode = '22023';
  end if;

  for question in select value from jsonb_array_elements(quiz_questions)
  loop
    if jsonb_typeof(question) <> 'object'
      or question ->> 'kind' not in ('photo-to-caption', 'caption-to-photo')
      or jsonb_typeof(question -> 'choiceIds') <> 'array'
    then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end if;

    begin
      question_memory_id := (question ->> 'memoryId')::uuid;
    exception when others then
      raise exception 'shared quiz questions are invalid' using errcode = '22023';
    end;

    if not exists (
      select 1 from public.shared_album_memories album_memory
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
        select 1 from public.shared_album_memories album_memory
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

  question_started_at := quiz_started_at + make_interval(secs => target_question_index * 5);
  question_ends_at := question_started_at + interval '5 seconds';
  if received_at < question_started_at then
    raise exception 'shared quiz question has not started' using errcode = '55000';
  end if;
  if received_at > question_ends_at then
    raise exception 'shared quiz question time expired' using errcode = '57014';
  end if;

  answer_time := least(5000, greatest(0, floor(extract(epoch from (received_at - question_started_at)) * 1000)::integer));
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
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select quiz.status, quiz.started_at
    into current_status, quiz_started_at
    from public.shared_quizzes quiz
    where quiz.id = target_quiz_id
    for update;
  if current_status is null or not (select private.can_view_shared_quiz(target_quiz_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  if current_status = 'completed' then return 'completed'; end if;
  if current_status <> 'active' or clock_timestamp() < quiz_started_at + interval '50 seconds' then
    raise exception 'shared quiz has not finished' using errcode = '55000';
  end if;

  update public.shared_quizzes quiz
    set status = 'completed', completed_at = quiz_started_at + interval '50 seconds'
    where quiz.id = target_quiz_id;
  return 'completed';
end;
$$;

revoke all on function public.finalize_shared_quiz(uuid) from public, anon, authenticated;
grant execute on function public.finalize_shared_quiz(uuid) to authenticated;

create or replace function public.list_shared_quiz_participants(target_quiz_id uuid)
returns table (
  user_id uuid,
  display_name text,
  joined_at timestamptz,
  answered_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (select private.can_view_shared_quiz(target_quiz_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  return query
    select participant.user_id, profile.display_name, participant.joined_at, count(answer.question_index)
      from public.shared_quiz_participants participant
      join public.profiles profile on profile.id = participant.user_id
      left join public.shared_quiz_answers answer
        on answer.quiz_id = participant.quiz_id
       and answer.user_id = participant.user_id
      where participant.quiz_id = target_quiz_id
      group by participant.user_id, profile.display_name, participant.joined_at
      order by participant.joined_at, participant.user_id;
end;
$$;

revoke all on function public.list_shared_quiz_participants(uuid) from public, anon, authenticated;
grant execute on function public.list_shared_quiz_participants(uuid) to authenticated;

create or replace function public.list_shared_quiz_standings(target_quiz_id uuid)
returns table (
  rank bigint,
  user_id uuid,
  display_name text,
  correct_count bigint,
  correct_time_ms bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if auth.uid() is null or not (select private.can_view_shared_quiz(target_quiz_id)) then
    raise exception 'shared quiz not found' using errcode = 'P0002';
  end if;
  select quiz.status into current_status
    from public.shared_quizzes quiz
    where quiz.id = target_quiz_id;
  if current_status <> 'completed' then
    raise exception 'shared quiz has not finished' using errcode = '55000';
  end if;

  return query
    with scores as (
      select
        participant.user_id,
        profile.display_name,
        participant.joined_at,
        count(answer.question_index) filter (where answer.is_correct) as correct_count,
        coalesce(sum(answer.response_time_ms) filter (where answer.is_correct), 0)::bigint as correct_time_ms
      from public.shared_quiz_participants participant
      join public.profiles profile on profile.id = participant.user_id
      left join public.shared_quiz_answers answer
        on answer.quiz_id = participant.quiz_id
       and answer.user_id = participant.user_id
      where participant.quiz_id = target_quiz_id
      group by participant.user_id, profile.display_name, participant.joined_at
    )
    select ranked.standing_rank, ranked.user_id, ranked.display_name, ranked.correct_count, ranked.correct_time_ms
      from (
        select
          row_number() over (
            order by scores.correct_count desc, scores.correct_time_ms asc, scores.joined_at asc, scores.user_id asc
          ) as standing_rank,
          scores.user_id,
          scores.display_name,
          scores.correct_count,
          scores.correct_time_ms
        from scores
      ) ranked
      order by ranked.standing_rank;
end;
$$;

revoke all on function public.list_shared_quiz_standings(uuid) from public, anon, authenticated;
grant execute on function public.list_shared_quiz_standings(uuid) to authenticated;
