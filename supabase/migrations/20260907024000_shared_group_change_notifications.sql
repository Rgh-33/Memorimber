-- Small invalidation records, never images, URLs or authoritative UI payloads.
create table public.shared_group_versions (
 group_id uuid primary key references public.shared_albums(id) on delete cascade,
 photos bigint not null default 0, settings bigint not null default 0, members bigint not null default 0
);
alter table public.shared_group_versions enable row level security;
revoke all on public.shared_group_versions from anon,authenticated;
grant select on public.shared_group_versions to authenticated;
create policy member_versions on public.shared_group_versions for select to authenticated using(private.is_shared_album_member(group_id));
insert into public.shared_group_versions(group_id) select a.id from public.shared_albums a;
create function private.invalidate_shared_group() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_group uuid;
begin
 if tg_table_name='shared_albums' then
  insert into public.shared_group_versions(group_id,settings) values(new.id,1)
   on conflict on constraint shared_group_versions_pkey do update set settings=public.shared_group_versions.settings+1;
 elsif tg_table_name='shared_album_memories' then
  v_group:=case when tg_op='DELETE' then old.album_id else new.album_id end;
  update public.shared_group_versions v set photos=v.photos+1 where v.group_id=v_group;
 elsif tg_table_name='shared_album_members' then
  v_group:=case when tg_op='DELETE' then old.album_id else new.album_id end;
  update public.shared_group_versions v set members=v.members+1 where v.group_id=v_group;
 elsif tg_table_name='memories' then
  update public.shared_group_versions v set photos=v.photos+1 where v.group_id in(select am.album_id from public.shared_album_memories am where am.memory_id=new.id);
 elsif tg_table_name='profiles' then
  update public.shared_group_versions v set members=v.members+1 where v.group_id in(select m.album_id from public.shared_album_members m where m.user_id=new.id);
 end if;
 return null;
end;
$$;
revoke all on function private.invalidate_shared_group() from public,anon,authenticated;
create trigger invalidate_album after insert or update on public.shared_albums for each row execute function private.invalidate_shared_group();
create trigger invalidate_shared_photos after insert or delete on public.shared_album_memories for each row execute function private.invalidate_shared_group();
create trigger invalidate_shared_members after insert or delete on public.shared_album_members for each row execute function private.invalidate_shared_group();
create trigger invalidate_shared_memory_data after update on public.memories for each row execute function private.invalidate_shared_group();
create trigger invalidate_shared_profile after update of display_name,avatar_url on public.profiles for each row execute function private.invalidate_shared_group();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='shared_group_versions') then alter publication supabase_realtime add table public.shared_group_versions; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_progress') then alter publication supabase_realtime add table public.profile_progress; end if;
 end if;
end $$;
-- Separate identity signals avoid progress -> group-version row locks, while
-- group mutations already acquire group-version -> progress locks.
create table public.profile_identity_versions (
 user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0
);
alter table public.profile_identity_versions enable row level security;
revoke all on public.profile_identity_versions from anon,authenticated;
grant select on public.profile_identity_versions to authenticated;
create policy shared_identity_signal on public.profile_identity_versions for select to authenticated using (
 user_id=auth.uid() or exists(select 1 from public.shared_album_members m where m.user_id=profile_identity_versions.user_id and private.is_shared_album_member(m.album_id))
);
insert into public.profile_identity_versions(user_id) select p.user_id from public.profile_progress p;
create function private.invalidate_shared_level() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.achieved_level is distinct from old.achieved_level then
  insert into public.profile_identity_versions(user_id,revision) values(new.user_id,1) on conflict on constraint profile_identity_versions_pkey do update set revision=public.profile_identity_versions.revision+1;
 end if;
 return null;
end;
$$;
revoke all on function private.invalidate_shared_level() from public,anon,authenticated;
create trigger invalidate_shared_level after update on public.profile_progress for each row execute function private.invalidate_shared_level();
create function public.get_shared_group_versions(p_group uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('photos',v.photos,'settings',v.settings,'members',v.members::text||':'||coalesce((select sum(p.achieved_level) from public.shared_album_members m join public.profile_progress p on p.user_id=m.user_id where m.album_id=p_group),0)::text)
 from public.shared_group_versions v where v.group_id=p_group and auth.uid() is not null and private.is_shared_album_member(p_group);
$$;
revoke all on function public.get_shared_group_versions(uuid) from public,anon,authenticated;
grant execute on function public.get_shared_group_versions(uuid) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.profile_identity_versions; end if;
end $$;

-- Notify removed users even after membership RLS hides the group. Process a
-- whole statement in UUID order instead of locking progress rows from a group
-- mutation. This also keeps current-value refresh separate from earned levels.
create function private.notify_membership_change() returns trigger language plpgsql security definer set search_path='' as $$
declare v_user uuid;
begin
 if tg_op='DELETE' then
  for v_user in select distinct m.user_id from old_members m order by m.user_id loop
   if exists(select 1 from auth.users u where u.id=v_user) then
    insert into public.profile_identity_versions(user_id,revision) values(v_user,1) on conflict on constraint profile_identity_versions_pkey do update set revision=public.profile_identity_versions.revision+1;
   end if;
  end loop;
 else
  for v_user in select distinct m.user_id from new_members m order by m.user_id loop
   insert into public.profile_identity_versions(user_id,revision) values(v_user,1) on conflict on constraint profile_identity_versions_pkey do update set revision=public.profile_identity_versions.revision+1;
  end loop;
 end if;
 return null;
end;
$$;
revoke all on function private.notify_membership_change() from public,anon,authenticated;
create trigger notify_membership_insert after insert on public.shared_album_members referencing new table as new_members for each statement execute function private.notify_membership_change();
create trigger notify_membership_delete after delete on public.shared_album_members referencing old table as old_members for each statement execute function private.notify_membership_change();
