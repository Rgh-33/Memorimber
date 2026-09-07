alter table public.shared_albums
 add column icon_path text,
 add column show_caption boolean not null default false,
 add column show_date boolean not null default false,
 add column quiz_mode text not null default 'random' check(quiz_mode in ('random','custom')),
 add column balance_quiz_contributors boolean not null default false,
 add column quiz_month_count smallint not null default 0 check(quiz_month_count between 0 and 10),
 add column quiz_photo_to_caption_count smallint not null default 5 check(quiz_photo_to_caption_count between 0 and 10),
 add column quiz_caption_to_photo_count smallint not null default 5 check(quiz_caption_to_photo_count between 0 and 10),
 add column quiz_seconds_per_question smallint not null default 5 check(quiz_seconds_per_question in (3,5,10)),
 add constraint shared_album_quiz_total check(quiz_month_count+quiz_photo_to_caption_count+quiz_caption_to_photo_count=10),
 add constraint shared_album_icon_path check(icon_path is null or icon_path ~ ('^'||id::text||'/icon-[0-9a-f-]{36}\.webp$'));
create table public.group_icon_uploads (
 path text primary key, album_id uuid not null, created_by uuid not null,
 state text not null default 'pending' check(state in ('pending','active','cleanup')),
 created_at timestamptz not null default clock_timestamp(), attempts integer not null default 0
);
alter table public.group_icon_uploads enable row level security;
revoke all on public.group_icon_uploads from anon,authenticated;
grant all on public.group_icon_uploads to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('shared-group-icons','shared-group-icons',false,5242880,array['image/webp']);
create policy group_icon_read on storage.objects for select to authenticated using(
 bucket_id='shared-group-icons' and exists(select 1 from public.shared_albums a where a.icon_path=name and private.is_shared_album_member(a.id))
);
create function public.reserve_group_icon(p_group uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_path text;
begin
 if auth.uid() is null or not private.is_shared_album_owner(p_group) then raise exception 'owner required' using errcode='42501'; end if;
 v_path:=p_group::text||'/icon-'||gen_random_uuid()::text||'.webp';
 insert into public.group_icon_uploads(path,album_id,created_by) values(v_path,p_group,auth.uid());
 return v_path;
end;
$$;
create function private.valid_group_icon_upload(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.group_icon_uploads u where u.path=p_path and u.created_by=auth.uid() and u.state='pending' and u.created_at>clock_timestamp()-interval '15 minutes' and private.is_shared_album_owner(u.album_id));
$$;
revoke all on function private.valid_group_icon_upload(text) from public,anon,authenticated;
grant execute on function private.valid_group_icon_upload(text) to authenticated;
create policy group_icon_upload on storage.objects for insert to authenticated with check(bucket_id='shared-group-icons' and private.valid_group_icon_upload(name));
-- Cleanup is privileged and only acts on retired reservations. Clients cannot
-- delete an active icon behind its DB reference.
create function public.commit_group_icon(p_group uuid,p_path text) returns void
language plpgsql security definer set search_path='' as $$
declare v_old text;
begin
 select a.icon_path into v_old from public.shared_albums a where a.id=p_group for update;
 if not found or not private.is_shared_album_owner(p_group) then raise exception 'owner required' using errcode='42501'; end if;
 if v_old is not distinct from p_path then return; end if;
 if p_path is not null then
  perform 1 from public.group_icon_uploads u where u.path=p_path and u.album_id=p_group and u.created_by=auth.uid() and u.state='pending' and u.created_at>clock_timestamp()-interval '15 minutes' for update;
  if not found or not exists(select 1 from storage.objects o where o.bucket_id='shared-group-icons' and o.name=p_path) then raise exception 'uploaded icon required' using errcode='22023'; end if;
  update public.group_icon_uploads u set state='active' where u.path=p_path;
 end if;
 update public.shared_albums a set icon_path=p_path where a.id=p_group;
 if v_old is not null and v_old is distinct from p_path then update public.group_icon_uploads u set state='cleanup' where u.path=v_old; end if;
end;
$$;
-- Existing owner UPDATE permissions must not bypass icon registration.
create function private.validate_group_icon_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.icon_path is not null and (tg_op='INSERT' or new.icon_path is distinct from old.icon_path) and not exists(
  select 1 from public.group_icon_uploads u where u.path=new.icon_path and u.album_id=new.id and u.state='active'
 ) then raise exception 'committed icon required' using errcode='23514'; end if;
 return new;
end;
$$;
create trigger validate_group_icon_reference before insert or update on public.shared_albums for each row execute function private.validate_group_icon_reference();
create function private.retire_group_icon() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.group_icon_uploads u set state='cleanup' where u.album_id=old.id;
 return old;
end;
$$;
create trigger retire_group_icons after delete on public.shared_albums for each row execute function private.retire_group_icon();
create function public.update_group_presentation(p_group uuid,p_patch jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_shared_album_owner(p_group) then raise exception 'owner required' using errcode='42501'; end if;
 if p_patch is null or jsonb_typeof(p_patch)<>'object' or exists(select 1 from jsonb_object_keys(p_patch) k where k not in ('showCaption','showDate','quizMode','balanceQuizContributors','quizMonthCount','quizPhotoToCaptionCount','quizCaptionToPhotoCount','quizSecondsPerQuestion')) or exists(select 1 from jsonb_each(p_patch) x where x.value='null'::jsonb) then raise exception 'invalid settings' using errcode='22023'; end if;
 update public.shared_albums a set
 show_caption=case when p_patch?'showCaption' then (p_patch->>'showCaption')::boolean else a.show_caption end,
 show_date=case when p_patch?'showDate' then (p_patch->>'showDate')::boolean else a.show_date end,
 quiz_mode=coalesce(p_patch->>'quizMode',a.quiz_mode),
 balance_quiz_contributors=case when p_patch?'balanceQuizContributors' then (p_patch->>'balanceQuizContributors')::boolean else a.balance_quiz_contributors end,
 quiz_month_count=coalesce((p_patch->>'quizMonthCount')::smallint,a.quiz_month_count),
 quiz_photo_to_caption_count=coalesce((p_patch->>'quizPhotoToCaptionCount')::smallint,a.quiz_photo_to_caption_count),
 quiz_caption_to_photo_count=coalesce((p_patch->>'quizCaptionToPhotoCount')::smallint,a.quiz_caption_to_photo_count),
 quiz_seconds_per_question=coalesce((p_patch->>'quizSecondsPerQuestion')::smallint,a.quiz_seconds_per_question)
 where a.id=p_group;
end;
$$;
-- Server-only projection: the API signs private avatar paths and never returns
-- these raw paths to the browser. Caller identity comes from verified auth.
create function public.server_group_profiles(p_caller uuid,p_group uuid,p_target uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 -- Membership checks and projection share one SQL snapshot.
 return (select case when p_caller is not null
 and exists(select 1 from public.shared_album_members caller where caller.album_id=p_group and caller.user_id=p_caller)
 and (p_target is null or exists(select 1 from public.shared_album_members target where target.album_id=p_group and target.user_id=p_target))
 then (select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',p.display_name,'role',m.role,'joinedAt',m.joined_at,'avatarPath',p.avatar_url,'canEdit',false,'progress',private.profile_snapshot(m.user_id)) order by (m.role='owner') desc,m.joined_at,m.user_id),'[]'::jsonb)
 from public.shared_album_members m join public.profiles p on p.id=m.user_id where m.album_id=p_group and (p_target is null or m.user_id=p_target))
 else null end);
end;
$$;
revoke all on function public.server_group_profiles(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.server_group_profiles(uuid,uuid,uuid) to service_role;
revoke all on function public.reserve_group_icon(uuid),public.commit_group_icon(uuid,text),public.update_group_presentation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_group_icon(uuid),public.commit_group_icon(uuid,text),public.update_group_presentation(uuid,jsonb) to authenticated;
revoke all on function private.validate_group_icon_reference(),private.retire_group_icon() from public,anon,authenticated;
-- Prevent ordinary table UPDATE from bypassing the icon commit/retirement flow.
revoke update on public.shared_albums from authenticated;
grant update(name) on public.shared_albums to authenticated;
