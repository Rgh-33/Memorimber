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
