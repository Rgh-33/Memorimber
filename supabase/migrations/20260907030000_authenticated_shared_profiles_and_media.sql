-- Normal Share/profile/quiz rendering uses auth.uid() and user-scoped Storage.
-- Existing migrations remain unchanged; apply after 20260907025000.
-- Indexed opaque lookup for server-side image streaming under the owner's
-- existing memories RLS. No answer/source IDs or Storage paths leave the RPC.
alter table public.memories add column quiz_media_ref text generated always as (md5(coalesce(thumbnail_path,image_path))) stored;
create index memories_quiz_media_ref_idx on public.memories(user_id,quiz_media_ref);

-- Authenticated opaque media lookup. The HTTP handler resolves this reference
-- against the caller's own memories under existing RLS and streams the image.
create function public.get_personal_quiz_media_ref(p_question uuid,p_choice text default null) returns text
language sql stable security definer set search_path='' as $$
 select m.quiz_media_ref
 from public.personal_quiz_questions q join public.personal_quiz_sessions s on s.id=q.session_id
 join public.memories m on m.id=case
   when p_choice is null and (q.kind<>'caption-to-photo' or q.answered_at is not null) then q.memory_id
   when p_choice is not null and q.kind='caption-to-photo' then
    (select c->>'memoryId' from jsonb_array_elements(q.choices) c where c->>'id'=p_choice)::uuid
   end
 where q.id=p_question and s.user_id=auth.uid() and m.user_id=auth.uid();
$$;
revoke all on function public.get_personal_quiz_media_ref(uuid,text) from public,anon,authenticated;
grant execute on function public.get_personal_quiz_media_ref(uuid,text) to authenticated;

-- Opaque avatar references, never Storage paths. Both identities are checked
-- in the requested group, using the authenticated caller rather than an input.
create function public.get_shared_group_avatar_ref(p_group uuid,p_target uuid) returns text
language sql stable security definer set search_path='' as $$
 select md5(p.avatar_url) from public.profiles p
 where p.id=p_target and p.avatar_url ~* ('^'||p.id::text||'/avatar-[0-9a-f-]{36}\.(jpg|png|webp)$')
 and auth.uid() is not null
 and exists(select 1 from public.shared_album_members caller join public.shared_album_members target on target.album_id=caller.album_id
   where caller.album_id=p_group and caller.user_id=auth.uid() and target.user_id=p_target);
$$;
-- Storage's SELECT is the minimum permission needed for list/download. It
-- admits only the currently referenced avatar of a current co-member, and does
-- not broaden profiles SELECT or grant any writes to another person's avatar.
create function private.can_read_shared_profile_avatar(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.profiles p join public.shared_album_members target on target.user_id=p.id
  join public.shared_album_members caller on caller.album_id=target.album_id and caller.user_id=auth.uid()
  where p.avatar_url=p_path and p_path ~* ('^'||p.id::text||'/avatar-[0-9a-f-]{36}\.(jpg|png|webp)$')
 );
$$;
revoke all on function private.can_read_shared_profile_avatar(text) from public,anon,authenticated;
grant execute on function private.can_read_shared_profile_avatar(text) to authenticated;
create policy current_shared_member_avatar_read on storage.objects for select to authenticated
 using(bucket_id='profile-avatars' and private.can_read_shared_profile_avatar(name));

create function public.get_shared_group_profiles(p_group uuid,p_target uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 -- Membership checks and projection share one SQL snapshot.
 return (select case when auth.uid() is not null
 and exists(select 1 from public.shared_album_members caller where caller.album_id=p_group and caller.user_id=auth.uid())
 and (p_target is null or exists(select 1 from public.shared_album_members target where target.album_id=p_group and target.user_id=p_target))
 then (select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'role',m.role,'joinedAt',m.joined_at,
 'avatarUrl',case when avatar.ref is not null then '/api/shared-groups/'||p_group::text||'/members/'||m.user_id::text||'/avatar?v='||avatar.ref else null end,
 'canEdit',false,'progress',progress.value || jsonb_build_object('stats',(progress.value->'stats')-array['randomQuizChallenges','fruitQuizCorrectAnswers','friendQuizSessions','printAttempts','savedAlbumLetters']))
 order by (m.role='owner') desc,m.joined_at,m.user_id),'[]'::jsonb)
 from public.shared_album_members m join public.profiles p on p.id=m.user_id
 cross join lateral (select private.profile_snapshot(m.user_id) as value) progress
 cross join lateral (select public.get_shared_group_avatar_ref(p_group,m.user_id) as ref) avatar
 where m.album_id=p_group and (p_target is null or m.user_id=p_target))
 else null end);
end;
$$;
revoke all on function public.get_shared_group_profiles(uuid,uuid),public.get_shared_group_avatar_ref(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_shared_group_profiles(uuid,uuid),public.get_shared_group_avatar_ref(uuid,uuid) to authenticated;

-- These former service-only rendering endpoints are replaced above. Actual
-- account deletion and cleanup RPCs/permissions are intentionally unchanged.
drop function public.server_group_profiles(uuid,uuid,uuid);
drop function public.server_personal_quiz_media(uuid,uuid,text);

-- User-scoped receipts supplement (never replace) the global retained queue.
-- A receipt is created only by a successful authenticated mutation trigger.
-- It deliberately survives group deletion / leaving; membership is not a
-- substitute for the recorded authorization to finish that specific operation.
create table public.authenticated_storage_cleanup (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id) on delete cascade,
 memory_id uuid,
 icon_path text,
 image_path text not null,
 thumbnail_path text,
 created_at timestamptz not null default clock_timestamp(),
 lease_token uuid,
 lease_until timestamptz,
 retry_after timestamptz not null default clock_timestamp(),
 attempts integer not null default 0 check(attempts>=0),
 constraint authenticated_cleanup_target check (
  (memory_id is not null and icon_path is null
   and image_path ~ ('^retained/'||memory_id::text||'/original\.[A-Za-z0-9]+$')
   and (thumbnail_path is null or thumbnail_path ~ ('^retained/'||memory_id::text||'/thumbnails/preview\.[A-Za-z0-9]+$')))
  or (memory_id is null and icon_path is not null and image_path=icon_path and thumbnail_path is null)
 ),
 constraint authenticated_cleanup_lease check ((lease_token is null)=(lease_until is null)),
 unique(actor_id,memory_id), unique(actor_id,icon_path)
);
alter table public.authenticated_storage_cleanup enable row level security;
revoke all on public.authenticated_storage_cleanup from public,anon,authenticated;
grant all on public.authenticated_storage_cleanup to service_role;
create index authenticated_cleanup_actor_retry on public.authenticated_storage_cleanup(actor_id,retry_after,created_at);
create index authenticated_cleanup_memory on public.authenticated_storage_cleanup(memory_id);

create function private.capture_authenticated_retained_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_memory public.memories%rowtype;
begin
 if auth.uid() is null then return old; end if;
 -- Capture a snapshot only: avoid acquiring target locks in arbitrary batch
 -- DELETE row order. Claim/finalize lock the target before receipt(s) and
 -- recheck current state after the successful deletion has committed.
 select m.* into v_memory from public.memories m where m.id=old.memory_id;
 if not found or v_memory.user_id is not null or v_memory.retained_at is null then return old; end if;
 insert into public.authenticated_storage_cleanup(actor_id,memory_id,image_path,thumbnail_path)
 values(auth.uid(),v_memory.id,v_memory.image_path,v_memory.thumbnail_path)
 on conflict on constraint authenticated_storage_cleanup_actor_id_memory_id_key do nothing;
 -- Capture every affected retained memory, even if another group still refers
 -- to it. Claim checks the post-commit reference count; simultaneous last-link
 -- deletions cannot lose the receipt. No Storage permission exists before claim.
 return old;
end;
$$;
create trigger capture_authenticated_retained_cleanup after delete on public.shared_album_memories
 for each row execute function private.capture_authenticated_retained_cleanup();

create function private.capture_authenticated_icon_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and new.created_by=auth.uid() and new.state='cleanup' then
  insert into public.authenticated_storage_cleanup(actor_id,icon_path,image_path)
  values(auth.uid(),new.path,new.path)
  on conflict on constraint authenticated_storage_cleanup_actor_id_icon_path_key do nothing;
 end if;
 return new;
end;
$$;
create trigger capture_authenticated_icon_cleanup after update of state on public.group_icon_uploads
 for each row execute function private.capture_authenticated_icon_cleanup();

-- A partially deleted retired target must never become live again, even after
-- its lease expires. Original paths cannot be swapped underneath a receipt.
create function private.protect_cleanup_memory() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.user_id,new.image_path,new.thumbnail_path,new.retained_at) is distinct from
    (old.user_id,old.image_path,old.thumbnail_path,old.retained_at)
 and exists(select 1 from public.authenticated_storage_cleanup c where c.memory_id=old.id) then
  raise exception 'retained cleanup target is immutable' using errcode='55000';
 end if;
 return new;
end;
$$;
create trigger protect_cleanup_memory before update on public.memories
 for each row execute function private.protect_cleanup_memory();
create function private.protect_cleanup_memory_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.memories m where m.id=new.memory_id for no key update;
 if exists(select 1 from public.authenticated_storage_cleanup c where c.memory_id=new.memory_id) then
  raise exception 'retired memory cannot be shared again' using errcode='55000';
 end if;
 return new;
end;
$$;
create trigger protect_cleanup_memory_reference before insert or update of memory_id on public.shared_album_memories
 for each row execute function private.protect_cleanup_memory_reference();

-- Called again by Storage SELECT / DELETE, not just when the receipt is made.
-- This function has no Storage queries, avoiding recursive Storage RLS.
create function private.authenticated_cleanup_target_safe(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.authenticated_storage_cleanup c where c.id=p_id and (
  (c.memory_id is not null and exists(select 1 from public.memories m
   where m.id=c.memory_id and m.user_id is null and m.retained_at is not null
    and m.image_path=c.image_path and m.thumbnail_path is not distinct from c.thumbnail_path)
   and not exists(select 1 from public.shared_album_memories am where am.memory_id=c.memory_id))
  or (c.icon_path is not null and exists(select 1 from public.group_icon_uploads u
   where u.path=c.icon_path and u.created_by=c.actor_id and u.state='cleanup')
   and not exists(select 1 from public.shared_albums a where a.icon_path=c.icon_path))
 ));
$$;
create function private.can_delete_authenticated_cleanup_object(p_bucket text,p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.authenticated_storage_cleanup c
  where c.actor_id=auth.uid() and c.lease_token is not null and c.lease_until>clock_timestamp()
   and p_bucket=case when c.memory_id is not null then 'memory-images' else 'shared-group-icons' end
   and (p_path=c.image_path or p_path=c.thumbnail_path)
   and private.authenticated_cleanup_target_safe(c.id));
$$;
create policy authenticated_cleanup_object_read on storage.objects for select to authenticated
 using(private.can_delete_authenticated_cleanup_object(bucket_id,name));
create policy authenticated_cleanup_object_delete on storage.objects for delete to authenticated
 using(private.can_delete_authenticated_cleanup_object(bucket_id,name));

create function public.claim_authenticated_storage_cleanup(p_limit integer default 2)
returns table(operation_id uuid,lease_token uuid,bucket_id text,paths text[])
language plpgsql security definer set search_path='' as $$
declare v_candidate record; v_job public.authenticated_storage_cleanup%rowtype; v_token uuid;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 if p_limit is null or p_limit<1 or p_limit>3 then raise exception 'invalid cleanup limit' using errcode='22023'; end if;
 -- Retire only this actor's expired reservations. Never expire an active icon.
 -- Limit this work too; normal Share requests do not scan/process the whole queue.
 update public.group_icon_uploads u set state='cleanup' where u.path in (
  select x.path from public.group_icon_uploads x where x.created_by=auth.uid()
   and x.state='pending' and x.created_at<clock_timestamp()-interval '15 minutes'
   order by x.created_at,x.path limit p_limit for update skip locked
 );
 for v_candidate in select c.id,c.memory_id,c.icon_path from public.authenticated_storage_cleanup c
  where c.actor_id=auth.uid() and c.retry_after<=clock_timestamp()
   and (c.lease_until is null or c.lease_until<=clock_timestamp())
   and private.authenticated_cleanup_target_safe(c.id)
  order by c.retry_after,c.created_at,c.id limit p_limit
 loop
  if v_candidate.memory_id is not null then
   perform 1 from public.memories m where m.id=v_candidate.memory_id for no key update skip locked;
  else
   perform 1 from public.group_icon_uploads u where u.path=v_candidate.icon_path for update skip locked;
  end if;
  if not found then continue; end if;
  select c.* into v_job from public.authenticated_storage_cleanup c where c.id=v_candidate.id
   and c.actor_id=auth.uid() and c.retry_after<=clock_timestamp()
   and (c.lease_until is null or c.lease_until<=clock_timestamp()) for update skip locked;
  if not found or not private.authenticated_cleanup_target_safe(v_job.id) then continue; end if;
  -- Only one actor may work on a retained memory at a time.
  if v_job.memory_id is not null and exists(select 1 from public.authenticated_storage_cleanup c
    where c.memory_id=v_job.memory_id and c.id<>v_job.id and c.lease_until>clock_timestamp()) then continue; end if;
  if v_job.memory_id is not null then
   -- Supplement any queue entry missed by concurrent last-link deletions.
   -- Never remove/change the pre-existing global queue on failure.
   insert into public.retained_memory_cleanup_queue(memory_id,image_path,thumbnail_path)
   values(v_job.memory_id,v_job.image_path,v_job.thumbnail_path)
   on conflict on constraint retained_memory_cleanup_queue_pkey do nothing;
  end if;
  v_token:=gen_random_uuid();
  update public.authenticated_storage_cleanup c set lease_token=v_token,
   lease_until=clock_timestamp()+interval '2 minutes',attempts=c.attempts+1,
   retry_after=clock_timestamp()+interval '30 seconds' where c.id=v_job.id;
  return query select v_job.id,v_token,
   case when v_job.memory_id is not null then 'memory-images'::text else 'shared-group-icons'::text end,
   array_remove(array[v_job.image_path,v_job.thumbnail_path],null::text);
 end loop;
end;
$$;

create function public.finish_authenticated_storage_cleanup(p_operation uuid,p_lease uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_job public.authenticated_storage_cleanup%rowtype;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='28000'; end if;
 select c.* into v_job from public.authenticated_storage_cleanup c where c.id=p_operation and c.actor_id=auth.uid();
 if not found then return false; end if;
 if v_job.memory_id is not null then
  perform 1 from public.memories m where m.id=v_job.memory_id for no key update;
 else
  perform 1 from public.group_icon_uploads u where u.path=v_job.icon_path for update;
 end if;
 select c.* into v_job from public.authenticated_storage_cleanup c where c.id=p_operation and c.actor_id=auth.uid()
  and c.lease_token=p_lease and c.lease_until>clock_timestamp() for update;
 if not found then return false; end if;
 if not private.authenticated_cleanup_target_safe(v_job.id)
  or exists(select 1 from storage.objects o where o.bucket_id=case when v_job.memory_id is not null then 'memory-images' else 'shared-group-icons' end
   and (o.name=v_job.image_path or o.name=v_job.thumbnail_path)) then
  update public.authenticated_storage_cleanup c set lease_token=null,lease_until=null,
   retry_after=clock_timestamp()+interval '30 seconds' where c.id=v_job.id;
  return false;
 end if;
 if v_job.memory_id is not null then
  delete from public.memories m where m.id=v_job.memory_id and m.user_id is null and m.retained_at is not null
   and m.image_path=v_job.image_path and m.thumbnail_path is not distinct from v_job.thumbnail_path
   and not exists(select 1 from public.shared_album_memories am where am.memory_id=m.id);
  if not found then return false; end if;
  delete from public.retained_memory_cleanup_queue q where q.memory_id=v_job.memory_id;
  delete from public.authenticated_storage_cleanup c where c.memory_id=v_job.memory_id;
 else
  delete from public.group_icon_uploads u where u.path=v_job.icon_path and u.state='cleanup';
  delete from public.authenticated_storage_cleanup c where c.id=v_job.id;
 end if;
 return true;
end;
$$;

-- Allow the global worker to finish rows without authenticated receipts too
-- (e.g. account-deletion jobs with no remaining memory). It cannot fabricate a
-- user's receipt. Storage deletion remains outside the SQL transaction.
create function public.retained_cleanup_paths(p_memory uuid) returns text[]
language plpgsql security definer set search_path='' as $$
declare v_queue public.retained_memory_cleanup_queue%rowtype; v_memory public.memories%rowtype;
begin
 perform 1 from public.memories m where m.id=p_memory for no key update;
 select q.* into v_queue from public.retained_memory_cleanup_queue q where q.memory_id=p_memory for update;
 if not found then return null; end if;
 if exists(select 1 from public.shared_album_memories am where am.memory_id=p_memory)
  or exists(select 1 from public.authenticated_storage_cleanup c where c.memory_id=p_memory and c.lease_until>clock_timestamp()) then return null; end if;
 select m.* into v_memory from public.memories m where m.id=p_memory;
 if found and (v_memory.user_id is not null or v_memory.retained_at is null
  or v_memory.image_path<>v_queue.image_path or v_memory.thumbnail_path is distinct from v_queue.thumbnail_path) then return null; end if;
 return array_remove(array[v_queue.image_path,v_queue.thumbnail_path],null::text);
end;
$$;
create function public.finish_retained_cleanup(p_memory uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_paths text[];
begin
 v_paths:=public.retained_cleanup_paths(p_memory);
 if v_paths is null or exists(select 1 from storage.objects o where o.bucket_id='memory-images' and o.name=any(v_paths)) then return false; end if;
 delete from public.memories m where m.id=p_memory and m.user_id is null;
 delete from public.retained_memory_cleanup_queue q where q.memory_id=p_memory;
 delete from public.authenticated_storage_cleanup c where c.memory_id=p_memory;
 return true;
end;
$$;
revoke all on function public.retained_cleanup_paths(uuid),public.finish_retained_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.retained_cleanup_paths(uuid),public.finish_retained_cleanup(uuid) to service_role;
revoke all on function private.capture_authenticated_retained_cleanup(),private.capture_authenticated_icon_cleanup(),
 private.protect_cleanup_memory(),private.protect_cleanup_memory_reference(),private.authenticated_cleanup_target_safe(uuid),
 private.can_delete_authenticated_cleanup_object(text,text),public.claim_authenticated_storage_cleanup(integer),
 public.finish_authenticated_storage_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function private.can_delete_authenticated_cleanup_object(text,text),
 public.claim_authenticated_storage_cleanup(integer),public.finish_authenticated_storage_cleanup(uuid,uuid) to authenticated;

create function public.finish_group_icon_cleanup(p_path text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.group_icon_uploads u where u.path=p_path and u.state='cleanup' for update;
 if not found or exists(select 1 from public.shared_albums a where a.icon_path=p_path)
  or exists(select 1 from storage.objects o where o.bucket_id='shared-group-icons' and o.name=p_path) then return false; end if;
 delete from public.group_icon_uploads u where u.path=p_path;
 delete from public.authenticated_storage_cleanup c where c.icon_path=p_path;
 return true;
end;
$$;
revoke all on function public.finish_group_icon_cleanup(text) from public,anon,authenticated;
grant execute on function public.finish_group_icon_cleanup(text) to service_role;

-- Keep reservation retirement from racing a Storage metadata INSERT that has
-- already passed the pending check. Hold the reservation lock through that
-- Storage transaction and recheck wall-clock expiry after obtaining the lock.
create or replace function private.valid_group_icon_upload(p_path text) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_upload public.group_icon_uploads%rowtype;
begin
 if auth.uid() is null then return false; end if;
 select u.* into v_upload from public.group_icon_uploads u
  where u.path=p_path and u.created_by=auth.uid() and u.state='pending' for share;
 return found and v_upload.created_at>clock_timestamp()-interval '15 minutes'
  and private.is_shared_album_owner(v_upload.album_id);
end;
$$;
revoke all on function private.valid_group_icon_upload(text) from public,anon,authenticated;
grant execute on function private.valid_group_icon_upload(text) to authenticated;
