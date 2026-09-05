-- Resumable account deletion with optional retention of memories that remain
-- linked from a shared album owned by somebody else.

alter table public.memories
  alter column user_id drop not null;

alter table public.memories
  add column retained_owner_name text,
  add column retained_at timestamptz;

alter table public.memories
  drop constraint memories_image_path_owned_by_user;

alter table public.memories
  add constraint memories_image_path_owned_or_retained check (
    (
      user_id is not null
      and (storage.foldername(image_path))[1] = user_id::text
    )
    or (
      user_id is null
      and image_path ~ ('^retained/' || id::text || '/original\.[A-Za-z0-9]+$')
    )
  );

alter table public.memories
  drop constraint memories_thumbnail_path_owned_by_user;

alter table public.memories
  add constraint memories_thumbnail_path_owned_or_retained check (
    thumbnail_path is null
    or (
      user_id is not null
      and coalesce((storage.foldername(thumbnail_path))[1] = user_id::text, false)
      and coalesce((storage.foldername(thumbnail_path))[2] = 'thumbnails', false)
      and thumbnail_path ~ ('^' || user_id::text || '/thumbnails/[^/].*')
    )
    or (
      user_id is null
      and thumbnail_path ~ ('^retained/' || id::text || '/thumbnails/preview\.[A-Za-z0-9]+$')
    )
  );

alter table public.memories
  add constraint memories_retained_owner_snapshot check (
    (
      user_id is not null
      and retained_owner_name is null
      and retained_at is null
    )
    or (
      user_id is null
      and retained_owner_name = btrim(retained_owner_name)
      and char_length(retained_owner_name) between 1 and 20
      and retained_at is not null
    )
  );

comment on column public.memories.retained_owner_name is
  'Display-name snapshot for a read-only memory retained after its owner leaves';
comment on column public.memories.retained_at is
  'Set only after a retained image has moved to the private retained prefix';

alter table public.shared_album_memories
  drop constraint shared_album_memories_added_by_fkey;

alter table public.shared_album_memories
  alter column added_by drop not null,
  add column added_by_display_name text;

alter table public.shared_album_memories
  add constraint shared_album_memories_added_by_fkey
  foreign key (added_by) references auth.users (id) on delete set null;

alter table public.shared_album_memories
  add constraint shared_album_memories_former_adder_snapshot check (
    added_by is not null
    or (
      added_by_display_name = btrim(added_by_display_name)
      and char_length(added_by_display_name) between 1 and 20
    )
  );

comment on column public.shared_album_memories.added_by_display_name is
  'Display-name snapshot used after the adding Auth account has been deleted';

create table public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  retain_shared_memories boolean not null default false,
  owner_name_snapshot text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint account_deletion_jobs_owner_name check (
    owner_name_snapshot = btrim(owner_name_snapshot)
    and char_length(owner_name_snapshot) between 1 and 20
  ),
  constraint account_deletion_jobs_status check (
    status in ('pending', 'processing', 'ready_for_auth', 'failed', 'completed')
  ),
  constraint account_deletion_jobs_attempts check (attempts >= 0),
  constraint account_deletion_jobs_completion check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index account_deletion_jobs_retry_idx
  on public.account_deletion_jobs (status, updated_at)
  where status <> 'completed';

create or replace function private.is_account_deletion_in_progress(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.account_deletion_jobs job
      where job.user_id = target_user_id
        and job.status <> 'completed'
  );
$$;

revoke all on function private.is_account_deletion_in_progress(uuid)
  from public, anon, authenticated;
grant execute on function private.is_account_deletion_in_progress(uuid)
  to authenticated;

-- Once preparation has snapshotted every owned object, prevent another tab
-- from creating a new object or memory that would escape that snapshot.
create policy "Accounts pending deletion cannot insert memories"
  on public.memories as restrictive
  for insert to authenticated
  with check (not (select private.is_account_deletion_in_progress(auth.uid())));

create policy "Accounts pending deletion cannot update memories"
  on public.memories as restrictive
  for update to authenticated
  using (not (select private.is_account_deletion_in_progress(auth.uid())))
  with check (not (select private.is_account_deletion_in_progress(auth.uid())));

create policy "Accounts pending deletion cannot delete memories"
  on public.memories as restrictive
  for delete to authenticated
  using (not (select private.is_account_deletion_in_progress(auth.uid())));

create policy "Accounts pending deletion cannot share memories"
  on public.shared_album_memories as restrictive
  for insert to authenticated
  with check (not (select private.is_account_deletion_in_progress(auth.uid())));

create policy "Accounts pending deletion cannot upload private images"
  on storage.objects as restrictive
  for insert to authenticated
  with check (
    bucket_id not in ('memory-images', 'profile-avatars')
    or not (select private.is_account_deletion_in_progress(auth.uid()))
  );

create policy "Accounts pending deletion cannot update private images"
  on storage.objects as restrictive
  for update to authenticated
  using (
    bucket_id not in ('memory-images', 'profile-avatars')
    or not (select private.is_account_deletion_in_progress(auth.uid()))
  )
  with check (
    bucket_id not in ('memory-images', 'profile-avatars')
    or not (select private.is_account_deletion_in_progress(auth.uid()))
  );

create policy "Accounts pending deletion cannot delete private images"
  on storage.objects as restrictive
  for delete to authenticated
  using (
    bucket_id not in ('memory-images', 'profile-avatars')
    or not (select private.is_account_deletion_in_progress(auth.uid()))
  );

create table public.account_deletion_retained_memories (
  job_id uuid not null references public.account_deletion_jobs (id) on delete cascade,
  memory_id uuid not null references public.memories (id) on delete cascade,
  source_image_path text not null,
  destination_image_path text not null,
  source_thumbnail_path text,
  destination_thumbnail_path text,
  primary key (job_id, memory_id),
  constraint account_deletion_retained_image_destination check (
    destination_image_path ~ ('^retained/' || memory_id::text || '/original\.[A-Za-z0-9]+$')
  ),
  constraint account_deletion_retained_thumbnail_destination check (
    (source_thumbnail_path is null and destination_thumbnail_path is null)
    or (
      source_thumbnail_path is not null
      and destination_thumbnail_path ~ ('^retained/' || memory_id::text || '/thumbnails/preview\.[A-Za-z0-9]+$')
    )
  )
);

create table public.account_deletion_storage_tasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.account_deletion_jobs (id) on delete cascade,
  bucket_id text not null,
  source_path text not null,
  operation text not null,
  destination_path text,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint account_deletion_storage_bucket check (
    bucket_id in ('memory-images', 'profile-avatars')
  ),
  constraint account_deletion_storage_operation check (
    (operation = 'delete' and destination_path is null)
    or (operation = 'move' and bucket_id = 'memory-images' and destination_path is not null)
  ),
  constraint account_deletion_storage_status check (
    status in ('pending', 'failed', 'completed')
  ),
  unique (bucket_id, source_path)
);

create index account_deletion_storage_tasks_retry_idx
  on public.account_deletion_storage_tasks (job_id, status, created_at)
  where status <> 'completed';

create table public.retained_memory_cleanup_queue (
  memory_id uuid primary key,
  image_path text not null,
  thumbnail_path text,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint retained_memory_cleanup_status check (status in ('pending', 'failed')),
  constraint retained_memory_cleanup_path check (image_path like 'retained/%')
);

alter table public.account_deletion_jobs enable row level security;
alter table public.account_deletion_retained_memories enable row level security;
alter table public.account_deletion_storage_tasks enable row level security;
alter table public.retained_memory_cleanup_queue enable row level security;

revoke all on table public.account_deletion_jobs from anon, authenticated;
revoke all on table public.account_deletion_retained_memories from anon, authenticated;
revoke all on table public.account_deletion_storage_tasks from anon, authenticated;
revoke all on table public.retained_memory_cleanup_queue from anon, authenticated;

create or replace function private.account_deletion_extension(object_path text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when object_path ~ '\.[A-Za-z0-9]+$'
      then lower(substring(object_path from '(\.[A-Za-z0-9]+)$'))
    else '.bin'
  end;
$$;

revoke all on function private.account_deletion_extension(text)
  from public, anon, authenticated;

create or replace function private.set_account_deletion_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_account_deletion_updated_at()
  from public, anon, authenticated;

create trigger on_account_deletion_job_updated
  before update on public.account_deletion_jobs
  for each row execute function private.set_account_deletion_updated_at();

create trigger on_account_deletion_storage_task_updated
  before update on public.account_deletion_storage_tasks
  for each row execute function private.set_account_deletion_updated_at();

create trigger on_retained_memory_cleanup_updated
  before update on public.retained_memory_cleanup_queue
  for each row execute function private.set_account_deletion_updated_at();

create or replace function public.prepare_my_account_deletion(retain_shared_memories boolean default false)
returns table (job_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  snapshot_name text;
  deletion_job_id uuid;
  current_status text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 84));

  select existing.id, existing.status
    into deletion_job_id, current_status
    from public.account_deletion_jobs existing
    where existing.user_id = caller_id;

  if deletion_job_id is not null then
    job_id := deletion_job_id;
    status := current_status;
    return next;
    return;
  end if;

  select profile.display_name
    into snapshot_name
    from public.profiles profile
    where profile.id = caller_id;

  if snapshot_name is null or btrim(snapshot_name) = '' then
    raise exception 'profile display name is required' using errcode = '23514';
  end if;

  insert into public.account_deletion_jobs (
    user_id,
    retain_shared_memories,
    owner_name_snapshot
  ) values (
    caller_id,
    coalesce(retain_shared_memories, false),
    snapshot_name
  )
  returning id into deletion_job_id;

  -- Groups owned by the leaving account disappear first. Cascades only remove
  -- group links; memories owned by other members remain untouched.
  delete from public.shared_albums album
    where album.owner_id = caller_id;

  if coalesce(retain_shared_memories, false) then
    insert into public.account_deletion_retained_memories (
      job_id,
      memory_id,
      source_image_path,
      destination_image_path,
      source_thumbnail_path,
      destination_thumbnail_path
    )
    select
      deletion_job_id,
      memory.id,
      memory.image_path,
      'retained/' || memory.id::text || '/original'
        || private.account_deletion_extension(memory.image_path),
      memory.thumbnail_path,
      case when memory.thumbnail_path is null then null else
        'retained/' || memory.id::text || '/thumbnails/preview'
          || private.account_deletion_extension(memory.thumbnail_path)
      end
    from public.memories memory
    where memory.user_id = caller_id
      and exists (
        select 1
          from public.shared_album_memories album_memory
          join public.shared_albums album on album.id = album_memory.album_id
          where album_memory.memory_id = memory.id
            and album.owner_id <> caller_id
      );
  end if;

  insert into public.account_deletion_storage_tasks (
    job_id, bucket_id, source_path, operation, destination_path
  )
  select deletion_job_id, 'memory-images', retained.source_image_path, 'move', retained.destination_image_path
    from public.account_deletion_retained_memories retained
    where retained.job_id = deletion_job_id
  on conflict (bucket_id, source_path) do nothing;

  insert into public.account_deletion_storage_tasks (
    job_id, bucket_id, source_path, operation, destination_path
  )
  select deletion_job_id, 'memory-images', retained.source_thumbnail_path, 'move', retained.destination_thumbnail_path
    from public.account_deletion_retained_memories retained
    where retained.job_id = deletion_job_id
      and retained.source_thumbnail_path is not null
  on conflict (bucket_id, source_path) do nothing;

  insert into public.account_deletion_storage_tasks (
    job_id, bucket_id, source_path, operation
  )
  select deletion_job_id, 'memory-images', memory.image_path, 'delete'
    from public.memories memory
    where memory.user_id = caller_id
      and not exists (
        select 1 from public.account_deletion_retained_memories retained
          where retained.job_id = deletion_job_id
            and retained.memory_id = memory.id
      )
  on conflict (bucket_id, source_path) do nothing;

  insert into public.account_deletion_storage_tasks (
    job_id, bucket_id, source_path, operation
  )
  select deletion_job_id, 'memory-images', memory.thumbnail_path, 'delete'
    from public.memories memory
    where memory.user_id = caller_id
      and memory.thumbnail_path is not null
      and not exists (
        select 1 from public.account_deletion_retained_memories retained
          where retained.job_id = deletion_job_id
            and retained.memory_id = memory.id
      )
  on conflict (bucket_id, source_path) do nothing;

  insert into public.account_deletion_storage_tasks (
    job_id, bucket_id, source_path, operation
  )
  select deletion_job_id, 'profile-avatars', profile.avatar_url, 'delete'
    from public.profiles profile
    where profile.id = caller_id
      and profile.avatar_url is not null
  on conflict (bucket_id, source_path) do nothing;

  job_id := deletion_job_id;
  status := 'pending';
  return next;
end;
$$;

revoke all on function public.prepare_my_account_deletion(boolean)
  from public, anon, authenticated;
grant execute on function public.prepare_my_account_deletion(boolean) to authenticated;

create or replace function public.get_my_account_deletion_job()
returns table (
  job_id uuid,
  status text,
  retain_shared_memories boolean,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select job.id, job.status, job.retain_shared_memories, job.updated_at
    from public.account_deletion_jobs job
    where job.user_id = (select auth.uid())
      and job.status <> 'completed';
$$;

revoke all on function public.get_my_account_deletion_job()
  from public, anon, authenticated;
grant execute on function public.get_my_account_deletion_job() to authenticated;

create or replace function public.finalize_account_deletion_job(target_job_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  deletion_job public.account_deletion_jobs%rowtype;
begin
  select job.*
    into deletion_job
    from public.account_deletion_jobs job
    where job.id = target_job_id
    for update;

  if deletion_job.id is null then
    raise exception 'account deletion job not found' using errcode = 'P0002';
  end if;

  if deletion_job.status in ('ready_for_auth', 'completed') then
    return deletion_job.status;
  end if;

  if exists (
    select 1 from public.account_deletion_storage_tasks task
      where task.job_id = target_job_id
        and task.status <> 'completed'
  ) then
    raise exception 'account deletion storage tasks remain' using errcode = '55000';
  end if;

  -- A group owner may remove a link while Storage is being processed. Only
  -- memories that still have a formal shared link are retained at finalization.
  update public.shared_album_memories album_memory
    set added_by_display_name = deletion_job.owner_name_snapshot
    where album_memory.added_by = deletion_job.user_id
      and exists (
        select 1 from public.account_deletion_retained_memories retained
          where retained.job_id = target_job_id
            and retained.memory_id = album_memory.memory_id
      );

  update public.memories memory
    set
      user_id = null,
      image_path = retained.destination_image_path,
      thumbnail_path = retained.destination_thumbnail_path,
      retained_owner_name = deletion_job.owner_name_snapshot,
      retained_at = now()
    from public.account_deletion_retained_memories retained
    where retained.job_id = target_job_id
      and retained.memory_id = memory.id
      and exists (
        select 1 from public.shared_album_memories album_memory
          where album_memory.memory_id = memory.id
      );

  insert into public.retained_memory_cleanup_queue (memory_id, image_path, thumbnail_path)
  select retained.memory_id, retained.destination_image_path, retained.destination_thumbnail_path
    from public.account_deletion_retained_memories retained
    join public.memories memory on memory.id = retained.memory_id
    where retained.job_id = target_job_id
      and memory.user_id = deletion_job.user_id
      and not exists (
        select 1 from public.shared_album_memories album_memory
          where album_memory.memory_id = retained.memory_id
      )
  on conflict (memory_id) do update set
    image_path = excluded.image_path,
    thumbnail_path = excluded.thumbnail_path,
    status = 'pending',
    last_error = null;

  delete from public.memories memory
    where memory.user_id = deletion_job.user_id;

  update public.account_deletion_jobs job
    set status = 'ready_for_auth', last_error = null
    where job.id = target_job_id;

  return 'ready_for_auth';
end;
$$;

revoke all on function public.finalize_account_deletion_job(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_account_deletion_job(uuid) to service_role;

create or replace function private.queue_unshared_retained_memory_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  retained_memory record;
begin
  if exists (
    select 1 from public.shared_album_memories remaining
      where remaining.memory_id = old.memory_id
  ) then
    return old;
  end if;

  select memory.id, memory.image_path, memory.thumbnail_path
    into retained_memory
    from public.memories memory
    where memory.id = old.memory_id
      and memory.user_id is null;

  if retained_memory.id is not null then
    insert into public.retained_memory_cleanup_queue (memory_id, image_path, thumbnail_path)
    values (retained_memory.id, retained_memory.image_path, retained_memory.thumbnail_path)
    on conflict (memory_id) do update set
      image_path = excluded.image_path,
      thumbnail_path = excluded.thumbnail_path,
      status = 'pending',
      last_error = null;
  end if;

  return old;
end;
$$;

revoke all on function private.queue_unshared_retained_memory_cleanup()
  from public, anon, authenticated;

create trigger on_shared_album_memory_deleted_queue_retained_cleanup
  after delete on public.shared_album_memories
  for each row execute function private.queue_unshared_retained_memory_cleanup();
