alter table public.shared_album_memories add column activity_event_id uuid not null default gen_random_uuid();
create unique index shared_album_memories_activity_event_idx on public.shared_album_memories(activity_event_id);
alter table public.memories add column letter_save_id uuid;
create table public.personal_quiz_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('quick','mixed','photo-to-caption','caption-to-photo','endless','fruit','recall')),
 photo_count integer, created_at timestamptz not null default clock_timestamp()
);
create table public.personal_quiz_questions (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.personal_quiz_sessions(id) on delete cascade,
 question_index integer not null check(question_index>=0), memory_id uuid references public.memories(id) on delete set null,
 kind text not null check(kind in ('month','photo-to-caption','caption-to-photo')),
 choices jsonb not null, correct_choice_id text not null, snapshot jsonb not null,
 selected_choice_id text, is_correct boolean, answered_at timestamptz, restored_at timestamptz,
 unique(session_id,question_index)
);
alter table public.personal_quiz_sessions enable row level security;
alter table public.personal_quiz_questions enable row level security;
revoke all on public.personal_quiz_sessions,public.personal_quiz_questions from anon,authenticated;
-- Questions/answers are exposed only through authenticated RPCs: no answer key
-- is available before an answer is committed.
create function private.personal_question_json(p_question public.personal_quiz_questions) returns jsonb
language sql stable set search_path='' as $$
 select p_question.snapshot || jsonb_build_object('id',p_question.id,'sessionId',p_question.session_id,'kind',p_question.kind,
 'choices',p_question.choices,'correctChoiceId',case when p_question.answered_at is not null then p_question.correct_choice_id else '' end,
 'correctLabel',case when p_question.answered_at is not null then case when p_question.kind='caption-to-photo' then 'この思い出の写真' else coalesce((select c->>'label' from jsonb_array_elements(p_question.choices) c where c->>'id'=p_question.correct_choice_id),p_question.snapshot->'memory'->>'caption') end else '' end,
 'correct',p_question.is_correct,'selectedChoiceId',p_question.selected_choice_id);
$$;
create function private.append_personal_question(p_session uuid,p_memory uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_session public.personal_quiz_sessions; v_memory public.memories; v_kind text; v_choices jsonb; v_correct text; v_question public.personal_quiz_questions; v_index integer;
begin
 select * into strict v_session from public.personal_quiz_sessions s where s.id=p_session for update;
 select count(*) into v_index from public.personal_quiz_questions q where q.session_id=p_session;
 select * into v_memory from public.memories m where m.user_id=v_session.user_id and (p_memory is null or m.id=p_memory) order by random() limit 1;
 if v_memory.id is null then raise exception 'no memories available' using errcode='22023'; end if;
 v_kind:=case when v_session.mode in ('photo-to-caption','caption-to-photo') then v_session.mode
 when v_session.mode='mixed' then case when v_index < v_session.photo_count then 'photo-to-caption' else 'caption-to-photo' end
 when v_session.mode in ('fruit','recall') then (array['photo-to-caption','caption-to-photo'])[1+floor(random()*2)::integer]
 else (array['month','photo-to-caption','caption-to-photo'])[1+floor(random()*3)::integer] end;
 if v_kind='month' then
  v_correct:=to_char(v_memory.memory_date,'YYYY-MM');
  select jsonb_agg(jsonb_build_object('id',x.month,'label',to_char(x.day,'YYYY年FMMM月')) order by random()) into v_choices
   from (select to_char(v_memory.memory_date+g.n*interval '1 month','YYYY-MM') as month,v_memory.memory_date+g.n*interval '1 month' as day from generate_series(-1,1) g(n)) x;
 else
  v_correct:=v_memory.id::text;
  select jsonb_agg(jsonb_build_object('id',x.id,'label',x.caption) order by random()) into v_choices from (
   select v_memory.id,v_memory.caption union all
   (select m.id,m.caption from public.memories m where m.user_id=v_session.user_id and m.id<>v_memory.id and (v_kind<>'photo-to-caption' or btrim(m.caption)<>btrim(v_memory.caption)) order by random() limit 2)
  ) x;
 end if;
 insert into public.personal_quiz_questions(session_id,question_index,memory_id,kind,choices,correct_choice_id,snapshot)
 values(p_session,v_index,v_memory.id,v_kind,v_choices,v_correct,jsonb_build_object('memoryId',v_memory.id,
 'prompt',case v_kind when 'month' then 'これはいつの思い出？' when 'photo-to-caption' then 'この写真に添えた一言は？' else '「'||v_memory.caption||'」の写真はどれ？' end,
 'memory',jsonb_build_object('id',v_memory.id,'caption',v_memory.caption,'date',v_memory.memory_date,'people',v_memory.people,'tags',v_memory.tags,'imageUrl','')))
 returning * into v_question;
 return private.personal_question_json(v_question);
end;
$$;
create function public.start_personal_quiz(p_mode text,p_count integer default 10,p_memory uuid default null,p_photo_count integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_session uuid; v_questions jsonb:='[]'; i integer;
begin
 if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_mode is null or p_mode not in ('quick','mixed','photo-to-caption','caption-to-photo','endless','fruit','recall') or p_count is null or p_count not between 1 and 100 then raise exception 'invalid quiz' using errcode='22023'; end if;
 if p_mode='mixed' and (p_photo_count is null or p_photo_count<0 or p_photo_count>50 or p_count-p_photo_count not between 0 and 50) then raise exception 'invalid mixed counts' using errcode='22023'; end if;
 if p_mode in ('fruit','recall') then
  if p_memory is null or not exists(select 1 from public.memory_fruits f join public.memories m on m.id=f.memory_id where m.user_id=v_user and m.id=p_memory and
   ((p_mode='fruit' and f.ripened_at is not null and f.harvested_at is null) or (p_mode='recall' and f.harvested_at is not null and greatest(f.harvested_at,coalesce(f.last_reviewed_at,f.harvested_at))<=clock_timestamp()-interval '7 days'))) then raise exception 'memory is unavailable' using errcode='42501'; end if;
  p_count:=1;
 end if;
 if p_mode='quick' then p_count:=10; end if;
 insert into public.personal_quiz_sessions(user_id,mode,photo_count) values(v_user,p_mode,p_photo_count) returning id into v_session;
 for i in 1..p_count loop v_questions:=v_questions || jsonb_build_array(private.append_personal_question(v_session,p_memory)); end loop;
 if p_mode='quick' then perform private.record_profile_event(v_user,'random-quiz',v_session::text,'{"randomQuizChallenges":1}'); end if;
 return jsonb_build_object('sessionId',v_session,'questions',v_questions);
end;
$$;
create function public.next_personal_quiz_question(p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_session public.personal_quiz_sessions; v_pending public.personal_quiz_questions;
begin
 select * into v_session from public.personal_quiz_sessions s where s.id=p_session and s.user_id=auth.uid() and s.mode='endless' for update;
 if v_session.id is null then raise exception 'quiz not found' using errcode='42501'; end if;
 select * into v_pending from public.personal_quiz_questions q where q.session_id=p_session and q.answered_at is null order by q.question_index limit 1;
 if v_pending.id is not null then return private.personal_question_json(v_pending); end if;
 return private.append_personal_question(p_session);
end;
$$;
create function public.answer_personal_quiz(p_question uuid,p_choice text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_q public.personal_quiz_questions; v_mode text; v_metrics jsonb:='{}';
begin
 select s.mode into v_mode from public.personal_quiz_sessions s join public.personal_quiz_questions q on q.session_id=s.id where q.id=p_question and s.user_id=auth.uid();
 if v_mode is null then raise exception 'quiz not found' using errcode='42501'; end if;
 select * into v_q from public.personal_quiz_questions q where q.id=p_question for update;
 if v_q.answered_at is not null then return private.personal_question_json(v_q); end if;
 if p_choice is null or not exists(select 1 from jsonb_array_elements(v_q.choices) c where c->>'id'=p_choice) then raise exception 'invalid choice' using errcode='22023'; end if;
 update public.personal_quiz_questions q set selected_choice_id=p_choice,is_correct=p_choice=q.correct_choice_id,answered_at=clock_timestamp() where q.id=p_question returning * into v_q;
 if v_q.is_correct then v_metrics:=v_metrics || '{"correctQuizAnswers":1}'; end if;
 if v_q.is_correct and v_mode='fruit' then v_metrics:=v_metrics || '{"fruitQuizCorrectAnswers":1}'; end if;
 if v_mode='endless' then v_metrics:=v_metrics || '{"endlessQuizQuestions":1}'; end if;
 perform private.record_profile_event(auth.uid(),'personal-answer',v_q.id::text,v_metrics);
 return private.personal_question_json(v_q);
end;
$$;
create function public.restore_memory_petal(p_question uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_q public.personal_quiz_questions;
begin
 select q.* into v_q from public.personal_quiz_questions q join public.personal_quiz_sessions s on s.id=q.session_id where q.id=p_question and s.user_id=auth.uid() and s.mode='recall' for update of q;
 if v_q.id is null or v_q.answered_at is null then raise exception 'answered recall required' using errcode='42501'; end if;
 if v_q.restored_at is not null then return; end if;
 update public.memory_fruits f set last_reviewed_at=clock_timestamp() from public.memories m where f.memory_id=v_q.memory_id and m.id=f.memory_id and m.user_id=auth.uid() and greatest(f.harvested_at,coalesce(f.last_reviewed_at,f.harvested_at))<=clock_timestamp()-interval '7 days';
 if not found then raise exception 'petal is not fading' using errcode='22023'; end if;
 update public.personal_quiz_questions q set restored_at=clock_timestamp() where q.id=v_q.id;
 perform private.record_profile_event(auth.uid(),'petal-restored',v_q.id::text,'{"revivedFadedMemories":1}');
end;
$$;
create function private.record_persisted_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_user uuid; v_metrics jsonb;
begin
 if tg_table_name='memories' then
  v_user:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if tg_op='UPDATE' and new.user_id is not null and (new.letter is distinct from old.letter or new.letter_save_id is distinct from old.letter_save_id) and char_length(btrim(coalesce(new.letter,'')))>0 then
   perform private.record_profile_event(new.user_id,'letter-saved',case when new.letter_save_id is distinct from old.letter_save_id then new.letter_save_id::text else gen_random_uuid()::text end,'{"savedAlbumLetters":1}');
  else perform private.evaluate_profile(v_user); end if;
 elsif tg_table_name='memory_fruits' then
  if old.harvested_at is null and new.harvested_at is not null then
   select m.user_id into v_user from public.memories m where m.id=new.memory_id;
   v_metrics:='{"harvestedFruits":1,"flownPetals":1}';
   if new.is_golden then v_metrics:=v_metrics || '{"goldenFruits":1}'; end if;
   perform private.record_profile_event(v_user,'harvest',new.memory_id::text,v_metrics,new.harvested_at);
  end if;
 elsif tg_table_name='shared_albums' then
  perform private.record_profile_event(new.owner_id,'group-created',new.id::text,'{"createdGroups":1}',new.created_at);
 elsif tg_table_name='shared_album_memories' then
  perform private.record_profile_event(new.added_by,'memory-shared',new.activity_event_id::text,'{"sharedMemories":1}',new.created_at);
 end if;
 return null;
end;
$$;
create trigger profile_memory_activity after insert or update or delete on public.memories for each row execute function private.record_persisted_activity();
create trigger profile_fruit_activity after update on public.memory_fruits for each row execute function private.record_persisted_activity();
create trigger profile_group_activity after insert on public.shared_albums for each row execute function private.record_persisted_activity();
create trigger profile_share_activity after insert on public.shared_album_memories for each row execute function private.record_persisted_activity();
revoke all on function private.personal_question_json(public.personal_quiz_questions),private.append_personal_question(uuid,uuid),private.record_persisted_activity() from public,anon,authenticated;
revoke all on function public.start_personal_quiz(text,integer,uuid,integer),public.next_personal_quiz_question(uuid),public.answer_personal_quiz(uuid,text),public.restore_memory_petal(uuid) from public,anon,authenticated;
grant execute on function public.start_personal_quiz(text,integer,uuid,integer),public.next_personal_quiz_question(uuid),public.answer_personal_quiz(uuid,text),public.restore_memory_petal(uuid) to authenticated;
create function public.get_personal_quiz_history() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.entry order by x.last_answer desc),'[]'::jsonb) from (
 select max(q.answered_at) as last_answer,jsonb_build_object('id',s.id,'mode',s.mode,'completedAt',max(q.answered_at),
 'answers',jsonb_agg(jsonb_build_object('memoryId',q.memory_id,'kind',q.kind,'prompt',q.snapshot->>'prompt','memoryCaption',q.snapshot->'memory'->>'caption',
 'selectedLabel',coalesce((select c->>'label' from jsonb_array_elements(q.choices) c where c->>'id'=q.selected_choice_id),''),
 'correctLabel',coalesce((select c->>'label' from jsonb_array_elements(q.choices) c where c->>'id'=q.correct_choice_id),''),'correct',q.is_correct) order by q.question_index)) as entry
 from public.personal_quiz_sessions s join public.personal_quiz_questions q on q.session_id=s.id
 where s.user_id=auth.uid() and s.mode not in ('fruit','recall') and q.answered_at is not null group by s.id order by max(q.answered_at) desc limit 30
 ) x;
$$;
revoke all on function public.get_personal_quiz_history() from public,anon,authenticated;
grant execute on function public.get_personal_quiz_history() to authenticated;

create or replace function public.complete_memory_harvest(
  p_memory_id uuid,
  p_word text
)
returns public.memory_fruits
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_word text := btrim(p_word);
  completed_at timestamptz := now();
  visible_until timestamptz;
  harvested_fruit public.memory_fruits;
begin
  if caller_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required to harvest a memory fruit';
  end if;

  if normalized_word is null
    or char_length(normalized_word) not between 1 and 12 then
    raise exception using
      errcode = '22023',
      message = 'Harvest word must contain between 1 and 12 characters';
  end if;

  if not exists (
    select 1 from public.personal_quiz_questions q join public.personal_quiz_sessions s on s.id=q.session_id
    where s.user_id=caller_id and s.mode='fruit' and q.memory_id=p_memory_id and q.answered_at is not null
  ) then raise exception 'answered fruit quiz required' using errcode='42501'; end if;

  visible_until := (
    date_trunc('month', completed_at at time zone 'Asia/Tokyo')
    + interval '1 month'
  ) at time zone 'Asia/Tokyo';

  update public.memory_fruits as fruits
  set
    harvested_at = completed_at,
    harvest_word = normalized_word,
    word_assigned_at = completed_at,
    home_visible_until = visible_until
  from public.memories
  where fruits.memory_id = p_memory_id
    and memories.id = fruits.memory_id
    and memories.user_id = caller_id
    and fruits.ripened_at is not null
    and fruits.harvested_at is null
  returning fruits.* into harvested_fruit;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Memory fruit is unavailable for harvest';
  end if;

  return harvested_fruit;
end;
$$;


create function private.assign_shared_activity_id() returns trigger language plpgsql set search_path='' as $$
begin new.activity_event_id:=gen_random_uuid(); return new; end;
$$;
revoke all on function private.assign_shared_activity_id() from public,anon,authenticated;
create trigger assign_shared_activity_id before insert on public.shared_album_memories for each row execute function private.assign_shared_activity_id();
