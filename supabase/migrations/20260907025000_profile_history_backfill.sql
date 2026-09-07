-- Historical aggregation is NOT event replay. No runtime record_profile_event
-- invocation is permitted in this migration. Missing history starts at zero.
-- Record historical identities directly to make existing shared quiz completion
-- and future retries idempotent without re-awarding any pre-migration activity.
insert into public.profile_activity_events(user_id,event_type,source_event_id,occurred_at,metadata)
select m.user_id,'harvest',f.memory_id::text,f.harvested_at,
 '{"harvestedFruits":1,"flownPetals":1}'::jsonb || case when f.is_golden then '{"goldenFruits":1}'::jsonb else '{}'::jsonb end
from public.memory_fruits f join public.memories m on m.id=f.memory_id where f.harvested_at is not null and m.user_id is not null
union all
select a.owner_id,'group-created',a.id::text,a.created_at,'{"createdGroups":1}'::jsonb from public.shared_albums a
union all
select am.added_by,'memory-shared',am.activity_event_id::text,am.created_at,'{"sharedMemories":1}'::jsonb from public.shared_album_memories am where am.added_by is not null
union all
select a.user_id,'shared-answer',a.quiz_id::text||':'||a.question_index::text,a.answered_at,'{"correctQuizAnswers":1}'::jsonb from public.shared_quiz_answers a where a.is_correct
union all
select p.user_id,'shared-start',q.id::text,q.started_at,'{"sharedQuizChallenges":1}'::jsonb || case when (select count(*) from public.shared_quiz_participants pp where pp.quiz_id=q.id)>=2 then '{"friendQuizSessions":1}'::jsonb else '{}'::jsonb end
from public.shared_quizzes q join public.shared_quiz_participants p on p.quiz_id=q.id where q.started_at is not null
on conflict on constraint profile_activity_events_pkey do nothing;
with scores as (
 select q.id as quiz_id,q.completed_at,p.user_id,p.joined_at,count(*) filter(where a.is_correct) as correct,
 coalesce(sum(a.response_time_ms) filter(where a.is_correct),0) as elapsed
 from public.shared_quizzes q join public.shared_quiz_participants p on p.quiz_id=q.id left join public.shared_quiz_answers a on a.quiz_id=q.id and a.user_id=p.user_id
 where q.status='completed' group by q.id,p.user_id,p.joined_at
), ranked as (
 select s.*,row_number() over(partition by s.quiz_id order by s.correct desc,s.elapsed,s.joined_at,s.user_id) as position,count(*) over(partition by s.quiz_id) as participants from scores s
)
insert into public.profile_activity_events(user_id,event_type,source_event_id,occurred_at,metadata)
select r.user_id,'shared-win',r.quiz_id::text,r.completed_at,'{"sharedQuizWins":1}' from ranked r where r.position=1 and r.participants>=2
on conflict on constraint profile_activity_events_pkey do nothing;
-- If any baseline was initialized while the schema was being installed,
-- shift it by ONLY the imported historical delta. Never count that delta as
-- post-activation progress, and never erase genuinely new activity.
with before_import as materialized (
 select c.user_id,c.metric,c.value from public.profile_activity_counters c
), aggregated as (
 select e.user_id,k.key as metric,sum(k.value::bigint) as value from public.profile_activity_events e
 cross join lateral jsonb_each_text(e.metadata) k group by e.user_id,k.key
), imported as (
 insert into public.profile_activity_counters(user_id,metric,value)
 select a.user_id,a.metric,a.value from aggregated a
 on conflict on constraint profile_activity_counters_pkey do update set value=excluded.value
 returning user_id,metric,value
)
update public.profile_level_baselines b set value=b.value+greatest(0,i.value-coalesce(previous.value,0))
from imported i left join before_import previous on previous.user_id=i.user_id and previous.metric=i.metric
where b.user_id=i.user_id and b.metric=i.metric;
-- All historical counters exist BEFORE initial photo-based advancement. At
-- level 9 the level-10 baseline therefore includes every historical harvest.
-- Later conditions similarly capture then-current counters when activated.
do $$ declare v_user uuid; begin
 for v_user in select p.user_id from public.profile_progress p order by p.user_id loop perform private.evaluate_profile(v_user); end loop;
end $$;
do $$ declare v_quiz uuid; begin
 for v_quiz in select q.id from public.shared_quizzes q where q.status='completed' loop perform private.snapshot_shared_quiz_results(v_quiz); end loop;
end $$;
