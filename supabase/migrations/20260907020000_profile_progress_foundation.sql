alter table public.memory_fruits add column last_reviewed_at timestamptz;
-- Authoritative progress. Existing migrations are intentionally untouched.
create table public.profile_progress (
 user_id uuid primary key references auth.users(id) on delete cascade,
 achieved_level smallint not null default 1 check (achieved_level between 1 and 20),
 revision bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profile_activity_counters (
 user_id uuid not null references public.profile_progress(user_id) on delete cascade,
 metric text not null, value bigint not null default 0 check (value >= 0), primary key(user_id,metric)
);
create table public.profile_activity_events (
 user_id uuid not null references public.profile_progress(user_id) on delete cascade,
 event_type text not null, source_event_id text not null check (char_length(source_event_id) between 1 and 128),
 amount integer not null default 1 check (amount > 0), occurred_at timestamptz not null default clock_timestamp(),
 metadata jsonb not null default '{}'::jsonb,
 primary key(user_id,event_type,source_event_id)
);
create index profile_activity_events_rate_idx on public.profile_activity_events(user_id,occurred_at);
create table public.profile_level_baselines (
 user_id uuid not null references public.profile_progress(user_id) on delete cascade,
 target_level smallint not null check (target_level between 2 and 20), metric text not null,
 value bigint not null check(value >= 0), primary key(user_id,target_level,metric)
);
alter table public.profile_progress enable row level security;
revoke all on public.profile_progress from anon, authenticated;
grant select on public.profile_progress to authenticated;
create policy own_progress on public.profile_progress for select to authenticated using(user_id = (select auth.uid()));
alter table public.profile_activity_counters enable row level security;
revoke all on public.profile_activity_counters from anon, authenticated;
grant select on public.profile_activity_counters to authenticated;
create policy own_progress on public.profile_activity_counters for select to authenticated using(user_id = (select auth.uid()));
alter table public.profile_activity_events enable row level security;
revoke all on public.profile_activity_events from anon, authenticated;
grant select on public.profile_activity_events to authenticated;
create policy own_progress on public.profile_activity_events for select to authenticated using(user_id = (select auth.uid()));
alter table public.profile_level_baselines enable row level security;
revoke all on public.profile_level_baselines from anon, authenticated;
grant select on public.profile_level_baselines to authenticated;
create policy own_progress on public.profile_level_baselines for select to authenticated using(user_id = (select auth.uid()));
create function private.profile_requirement(p_level integer)
returns table(photos integer, metric text, required integer)
language sql immutable set search_path = '' as $$
 select (array[0,1,6,13,23,34,46,59,73,88,103,118,133,148,163,178,193,208,223,238])[p_level],
 case p_level when 10 then 'harvestedFruits' when 11 then 'randomQuizChallenges'
 when 12 then 'harvestedFruits' when 13 then 'fruitQuizCorrectAnswers' when 14 then 'createdGroups'
 when 15 then 'revivedFadedMemories' when 16 then 'printAttempts' when 17 then 'friendQuizSessions'
 when 18 then 'savedAlbumLetters' when 19 then 'goldenFruits' end,
 case p_level when 10 then 5 when 12 then 15 when 13 then 15 else 1 end;
$$;
create function private.evaluate_profile(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_level integer; v_photos bigint; v_requirement record; v_total bigint; v_baseline bigint;
begin
 if p_user is null or not exists(select 1 from auth.users u where u.id=p_user) then return; end if;
 insert into public.profile_progress(user_id) values(p_user) on conflict on constraint profile_progress_pkey do nothing;
 select p.achieved_level into v_level from public.profile_progress p where p.user_id=p_user for update;
 select count(*) into v_photos from public.memories m where m.user_id=p_user;
 while v_level < 20 loop
  select * into v_requirement from private.profile_requirement(v_level+1);
  if v_requirement.metric is not null then
   select coalesce((select c.value from public.profile_activity_counters c where c.user_id=p_user and c.metric=v_requirement.metric),0) into v_total;
   insert into public.profile_level_baselines(user_id,target_level,metric,value)
    values(p_user,v_level+1,v_requirement.metric,v_total) on conflict on constraint profile_level_baselines_pkey do nothing;
   select b.value into v_baseline from public.profile_level_baselines b where b.user_id=p_user and b.target_level=v_level+1 and b.metric=v_requirement.metric;
   exit when v_total-v_baseline < v_requirement.required;
  end if;
  exit when v_photos < v_requirement.photos;
  v_level := v_level+1;
 end loop;
 update public.profile_progress p set achieved_level=greatest(p.achieved_level,v_level),revision=p.revision+1,updated_at=clock_timestamp() where p.user_id=p_user;
end;
$$;
-- Only validated triggers/RPCs may invoke this internal operation. A single
-- success may increment several metrics; evaluate only after the whole event.
create function private.record_profile_event(p_user uuid,p_type text,p_source text,p_metrics jsonb,p_time timestamptz default clock_timestamp(),p_evaluate boolean default true)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_item record;
begin
 if p_user is null or not exists(select 1 from auth.users u where u.id=p_user) then return false; end if;
 if p_evaluate then perform private.evaluate_profile(p_user); end if;
 perform 1 from public.profile_progress p where p.user_id=p_user for update;
 insert into public.profile_activity_events(user_id,event_type,source_event_id,occurred_at,metadata)
 values(p_user,p_type,p_source,p_time,p_metrics) on conflict on constraint profile_activity_events_pkey do nothing;
 if not found then return false; end if;
 for v_item in select key,value from jsonb_each_text(p_metrics) loop
  if v_item.value::bigint < 1 then raise exception 'invalid internal metric'; end if;
  insert into public.profile_activity_counters(user_id,metric,value) values(p_user,v_item.key,v_item.value::bigint)
   on conflict on constraint profile_activity_counters_pkey do update set value=public.profile_activity_counters.value+excluded.value;
 end loop;
 if p_evaluate then perform private.evaluate_profile(p_user); end if;
 return true;
end;
$$;
create function private.profile_snapshot(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 with counts as (
 select count(*) as photos,count(distinct to_char(m.memory_date,'YYYY-MM')) as months,
 count(*) filter(where m.album_appearance is not null) as designs from public.memories m where m.user_id=p_user
 ), activity as (
 select coalesce(jsonb_object_agg(c.metric,c.value),'{}'::jsonb) as totals from public.profile_activity_counters c where c.user_id=p_user
 )
 select jsonb_build_object('achievedLevel',p.achieved_level,'revision',p.revision,
 'photosIntoLevel',case when p.achieved_level=20 then 15 else counts.photos-current_req.photos end,
 'photosForNextLevel',case when p.achieved_level=20 then 15 else next_req.photos-current_req.photos end,
 'stats','{"harvestedFruits":0,"correctQuizAnswers":0,"flownPetals":0,"revivedFadedMemories":0,"wordRecallReveals":0,"goldenFruits":0,"createdGroups":0,"sharedQuizChallenges":0,"sharedQuizWins":0,"endlessQuizQuestions":0,"sharedMemories":0,"randomQuizChallenges":0,"fruitQuizCorrectAnswers":0,"friendQuizSessions":0,"printAttempts":0,"savedAlbumLetters":0}'::jsonb || activity.totals || jsonb_build_object('uploadedPhotos',counts.photos,'activeMonths',counts.months,'designedMemories',counts.designs,
 'joinedGroups',(select count(*) from public.shared_album_members a where a.user_id=p_user),
 'connectedPeople',(select count(distinct other.user_id) from public.shared_album_members own join public.shared_album_members other on other.album_id=own.album_id where own.user_id=p_user and other.user_id<>p_user)))
 from public.profile_progress p cross join counts cross join activity
 cross join lateral private.profile_requirement(p.achieved_level) current_req
 cross join lateral private.profile_requirement(least(20,p.achieved_level+1)) next_req where p.user_id=p_user;
$$;
create function public.get_profile_progress() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 return private.profile_snapshot(auth.uid());
end;
$$;
create function public.record_profile_client_event(p_type text,p_source text,p_memory uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_type is null or p_type not in ('printAttempts','wordRecallReveals') or p_source is null or char_length(p_source) not between 1 and 128 then
  raise exception 'invalid event' using errcode='22023';
 end if;
 if p_type='wordRecallReveals' then
  perform 1 from public.memory_fruits f join public.memories m on m.id=f.memory_id where m.id=p_memory and m.user_id=v_user and f.harvested_at is not null for update of f;
  if not found then raise exception 'harvested memory required' using errcode='42501'; end if;
 end if;
 perform 1 from public.profile_progress p where p.user_id=v_user for update;
 if exists(select 1 from public.profile_activity_events e where e.user_id=v_user and e.event_type=p_type and e.source_event_id=p_source) then return private.profile_snapshot(v_user); end if;
 if (select count(*) from public.profile_activity_events e where e.user_id=v_user and e.event_type in ('printAttempts','wordRecallReveals') and e.occurred_at>clock_timestamp()-interval '1 minute')>=60 then
  raise exception 'event rate limit exceeded' using errcode='54000';
 end if;
 perform private.record_profile_event(v_user,p_type,p_source,jsonb_build_object(p_type,1));
 if p_type='wordRecallReveals' then update public.memory_fruits f set last_reviewed_at=clock_timestamp() where f.memory_id=p_memory; end if;
 return private.profile_snapshot(v_user);
end;
$$;
revoke all on function private.profile_requirement(integer),private.evaluate_profile(uuid),private.record_profile_event(uuid,text,text,jsonb,timestamptz,boolean),private.profile_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.get_profile_progress(),public.record_profile_client_event(text,text,uuid) from public,anon,authenticated;
grant execute on function public.get_profile_progress(),public.record_profile_client_event(text,text,uuid) to authenticated;
create function private.initialize_profile_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profile_progress(user_id) values(new.id) on conflict on constraint profile_progress_pkey do nothing;
 return new;
end;
$$;
revoke all on function private.initialize_profile_progress() from public,anon,authenticated;
create trigger initialize_profile_progress after insert on auth.users for each row execute function private.initialize_profile_progress();
insert into public.profile_progress(user_id) select u.id from auth.users u on conflict on constraint profile_progress_pkey do nothing;
