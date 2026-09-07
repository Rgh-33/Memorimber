alter table public.shared_quizzes add column participant_snapshot uuid[];
-- Replace the old client-plan entry point: its plan argument is ignored and
-- all material, configuration and choices are selected inside this transaction.
create or replace function public.start_shared_quiz(target_quiz_id uuid,quiz_questions jsonb)
returns table(quiz_status text,started_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_quiz public.shared_quizzes; v_album public.shared_albums; v_pool uuid[]; v_choices uuid[]; v_people uuid[];
 v_plan jsonb:='[]'; v_kind text; v_id uuid; v_kinds text[]; v_seconds integer; v_start timestamptz; v_snapshots jsonb; v_previous text; v_swap text; i integer; j integer;
begin
 -- join_shared_quiz locks album before quiz; use exactly the same order.
 select q.album_id into v_album.id from public.shared_quizzes q where q.id=target_quiz_id;
 select * into v_album from public.shared_albums a where a.id=v_album.id for update;
 select * into v_quiz from public.shared_quizzes q where q.id=target_quiz_id for update;
 if v_quiz.id is null or auth.uid() is null or not private.is_shared_album_owner(v_quiz.album_id) then raise exception 'only the shared album owner can start a quiz' using errcode='42501'; end if;
 if v_quiz.status<>'waiting' then raise exception 'shared quiz is not waiting' using errcode='55000'; end if;
 select array_agg(p.user_id order by p.user_id) into v_people from public.shared_quiz_participants p join public.shared_album_members m on m.album_id=v_album.id and m.user_id=p.user_id where p.quiz_id=target_quiz_id;
 if v_people is null or not auth.uid()=any(v_people) then raise exception 'shared quiz participant not found' using errcode='42501'; end if;
 if v_album.balance_quiz_contributors then
  with available as (
   select am.memory_id,am.added_by,row_number() over(partition by am.added_by order by random()) as n,count(*) over(partition by am.added_by) as amount
   from public.shared_album_memories am join public.memories m on m.id=am.memory_id where am.album_id=v_album.id and am.added_by=any(v_people)
  ) select array_agg(a.memory_id order by a.n,md5(a.added_by::text||target_quiz_id::text)) into v_pool from available a where a.n<=(select min(b.amount) from available b);
 else
  select array_agg(x.memory_id) into v_pool from (select am.memory_id from public.shared_album_memories am join public.memories m on m.id=am.memory_id where am.album_id=v_album.id order by random()) x;
 end if;
 if coalesce(cardinality(v_pool),0)=0 then raise exception 'shared quiz questions are invalid' using errcode='22023'; end if;
 if v_album.quiz_mode='custom' then
  select array_agg(x.kind order by random()) into v_kinds from (
   select 'month'::text as kind from generate_series(1,v_album.quiz_month_count)
   union all select 'photo-to-caption' from generate_series(1,v_album.quiz_photo_to_caption_count)
   union all select 'caption-to-photo' from generate_series(1,v_album.quiz_caption_to_photo_count)
  ) x;
  v_seconds:=v_album.quiz_seconds_per_question;
 else v_seconds:=5; end if;
 for i in 1..10 loop
  v_id:=v_pool[1+(i-1)%cardinality(v_pool)];
  if v_album.quiz_mode='custom' then
   select q.item->>'kind' into v_previous from jsonb_array_elements(v_plan) with ordinality q(item,n) where q.item->>'memoryId'=v_id::text order by q.n desc limit 1;
   if v_kinds[i]=v_previous then
    for j in i+1..10 loop
     if v_kinds[j]<>v_previous then v_swap:=v_kinds[i]; v_kinds[i]:=v_kinds[j]; v_kinds[j]:=v_swap; exit; end if;
    end loop;
   end if;
  end if;
  v_kind:=case when v_album.quiz_mode='custom' then v_kinds[i] else (array['month','photo-to-caption','caption-to-photo'])[1+(((i-1)%cardinality(v_pool))+(i-1)/cardinality(v_pool))%3] end;
  select array_agg(x.id order by random()) into v_choices from (
   select v_id as id union all (
    select d.id from (
     select distinct on (case when v_kind='month' then to_char(m.memory_date,'YYYY-MM') when v_kind='photo-to-caption' then m.caption else m.id::text end) m.id
     from unnest(v_pool) u(id) join public.memories m on m.id=u.id join public.memories target on target.id=v_id
     where u.id<>v_id and (v_kind<>'month' or to_char(m.memory_date,'YYYY-MM')<>to_char(target.memory_date,'YYYY-MM'))
      and (v_kind<>'photo-to-caption' or btrim(m.caption)<>btrim(target.caption))
     order by case when v_kind='month' then to_char(m.memory_date,'YYYY-MM') when v_kind='photo-to-caption' then m.caption else m.id::text end,random()
    ) d order by random() limit 2
   )
  ) x;
  select jsonb_object_agg(m.id,jsonb_build_object('caption',m.caption,'date',m.memory_date)) into v_snapshots from public.memories m where m.id=any(v_choices);
  v_plan:=v_plan || jsonb_build_array(jsonb_build_object('memoryId',v_id,'kind',v_kind,'choiceIds',to_jsonb(v_choices),'secondsPerQuestion',v_seconds,'snapshots',v_snapshots));
 end loop;
 v_start:=clock_timestamp()+interval '5 seconds';
 update public.shared_quizzes q set questions=v_plan,participant_snapshot=v_people,started_at=v_start,status='active' where q.id=target_quiz_id;
 quiz_status:='active'; started_at:=v_start; return next;
end;
$$;
create function private.record_shared_quiz_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_people uuid[]; v_winner uuid; v_metrics jsonb;
begin
 if tg_table_name='shared_quiz_answers' then
  if new.is_correct then perform private.record_profile_event(new.user_id,'shared-answer',new.quiz_id::text||':'||new.question_index::text,'{"correctQuizAnswers":1}',new.answered_at); end if;
  return null;
 end if;
 v_people:=new.participant_snapshot;
 if v_people is null then select array_agg(p.user_id order by p.user_id) into v_people from public.shared_quiz_participants p where p.quiz_id=new.id; end if;
 if old.status='waiting' and new.status='active' then
  foreach v_user in array coalesce(v_people,'{}'::uuid[]) loop
   v_metrics:='{"sharedQuizChallenges":1}';
   if cardinality(v_people)>=2 then v_metrics:=v_metrics || '{"friendQuizSessions":1}'; end if;
   perform private.record_profile_event(v_user,'shared-start',new.id::text,v_metrics,new.started_at);
  end loop;
 elsif old.status<>'completed' and new.status='completed' and cardinality(v_people)>=2 then
  select p.user_id into v_winner from public.shared_quiz_participants p left join public.shared_quiz_answers a on a.quiz_id=p.quiz_id and a.user_id=p.user_id
   where p.quiz_id=new.id and p.user_id=any(v_people)
   group by p.user_id,p.joined_at order by count(*) filter(where a.is_correct) desc,coalesce(sum(a.response_time_ms) filter(where a.is_correct),0),p.joined_at,p.user_id limit 1;
  if v_winner is not null then perform private.record_profile_event(v_winner,'shared-win',new.id::text,'{"sharedQuizWins":1}',new.completed_at); end if;
 end if;
 return null;
end;
$$;
revoke all on function private.record_shared_quiz_activity() from public,anon,authenticated;
create trigger record_shared_quiz_activity after update on public.shared_quizzes for each row execute function private.record_shared_quiz_activity();
create trigger record_shared_answer_activity after insert on public.shared_quiz_answers for each row execute function private.record_shared_quiz_activity();

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
  if target_question_index is null or target_selected_choice_id is null or target_question_index not between 0 and 9 then
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

  if not exists(select 1 from public.shared_quizzes q where q.id=target_quiz_id and (q.participant_snapshot is null or caller_id=any(q.participant_snapshot))) then raise exception 'shared quiz participant not found' using errcode='42501'; end if;
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

-- Freeze final scores so later account/answer deletion cannot change the winner.
create table public.shared_quiz_results (
 quiz_id uuid not null references public.shared_quizzes(id) on delete cascade,
 user_id uuid not null, display_name text not null, rank bigint not null,
 correct_count bigint not null, correct_time_ms bigint not null, primary key(quiz_id,user_id), unique(quiz_id,rank)
);
alter table public.shared_quiz_results enable row level security;
revoke all on public.shared_quiz_results from anon,authenticated;
create function private.snapshot_shared_quiz_results(p_quiz uuid) returns void
language sql security definer set search_path='' as $$
 insert into public.shared_quiz_results(quiz_id,user_id,display_name,rank,correct_count,correct_time_ms)
 select p_quiz,s.user_id,s.display_name,row_number() over(order by s.correct_count desc,s.correct_time_ms,s.joined_at,s.user_id),s.correct_count,s.correct_time_ms
 from (
  select p.user_id,profile.display_name,p.joined_at,count(a.question_index) filter(where a.is_correct) as correct_count,coalesce(sum(a.response_time_ms) filter(where a.is_correct),0)::bigint as correct_time_ms
  from public.shared_quiz_participants p join public.profiles profile on profile.id=p.user_id join public.shared_quizzes q on q.id=p.quiz_id
  left join public.shared_quiz_answers a on a.quiz_id=p.quiz_id and a.user_id=p.user_id
  where p.quiz_id=p_quiz and q.status='completed' and (q.participant_snapshot is null or p.user_id=any(q.participant_snapshot))
  group by p.user_id,profile.display_name,p.joined_at
 ) s on conflict on constraint shared_quiz_results_pkey do nothing;
$$;
create function private.freeze_completed_quiz() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status<>'completed' and new.status='completed' then perform private.snapshot_shared_quiz_results(new.id); end if;
 return null;
end;
$$;
create trigger a_freeze_completed_quiz after update on public.shared_quizzes for each row execute function private.freeze_completed_quiz();
create or replace function public.list_shared_quiz_standings(target_quiz_id uuid)
returns table(rank bigint,user_id uuid,display_name text,correct_count bigint,correct_time_ms bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can_view_shared_quiz(target_quiz_id) then raise exception 'shared quiz not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.shared_quizzes q where q.id=target_quiz_id and q.status='completed') then raise exception 'shared quiz has not finished' using errcode='55000'; end if;
 return query select r.rank,r.user_id,r.display_name,r.correct_count,r.correct_time_ms from public.shared_quiz_results r where r.quiz_id=target_quiz_id order by r.rank;
end;
$$;
revoke all on function private.snapshot_shared_quiz_results(uuid),private.freeze_completed_quiz() from public,anon,authenticated;
