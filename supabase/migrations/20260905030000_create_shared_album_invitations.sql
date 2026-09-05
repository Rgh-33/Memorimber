-- Account-bound invitations and in-app notifications for shared albums.
-- Email addresses are resolved only inside invite_to_shared_album and are never
-- stored in either public table or returned from an application RPC.
create table public.shared_album_invitations (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.shared_albums (id) on delete cascade,
  inviter_id uuid not null references auth.users (id) on delete cascade,
  invitee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz,
  constraint shared_album_invitations_status check (
    status in ('pending', 'accepted', 'declined', 'expired')
  ),
  constraint shared_album_invitations_not_self check (inviter_id <> invitee_id),
  constraint shared_album_invitations_seven_day_expiry check (
    expires_at = created_at + interval '7 days'
  ),
  constraint shared_album_invitations_response_time check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create unique index shared_album_invitations_one_pending_idx
  on public.shared_album_invitations (album_id, invitee_id)
  where status = 'pending';

create index shared_album_invitations_invitee_idx
  on public.shared_album_invitations (invitee_id, created_at desc);

create index shared_album_invitations_album_idx
  on public.shared_album_invitations (album_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  invitation_id uuid not null unique
    references public.shared_album_invitations (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_type check (type = 'shared_album_invitation'),
  constraint notifications_read_time check (
    read_at is null or read_at >= created_at
  )
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

comment on table public.shared_album_invitations is
  'Seven-day account invitations resolved from Auth email without storing email addresses';
comment on table public.notifications is
  'Recipient-private in-app notifications; currently shared album invitations only';

create or replace function private.enforce_notification_read_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'read notifications cannot be made unread'
      using errcode = '23514';
  end if;
  if old.read_at is null and new.read_at is null then
    raise exception 'read_at is required when marking a notification read'
      using errcode = '23514';
  end if;
  if old.read_at is null then
    new.read_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_notification_read_transition()
  from public, anon, authenticated;

create trigger on_notification_updated_enforce_read_transition
  before update of read_at on public.notifications
  for each row execute function private.enforce_notification_read_transition();

alter table public.shared_album_invitations enable row level security;
alter table public.notifications enable row level security;

create policy "Invitees can view their own shared album invitations"
  on public.shared_album_invitations
  for select
  to authenticated
  using (invitee_id = (select auth.uid()));

create policy "Recipients can view their own notifications"
  on public.notifications
  for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "Recipients can mark their own notifications read"
  on public.notifications
  for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on table public.shared_album_invitations from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.shared_album_invitations to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

create or replace function private.expire_shared_album_invitations(
  target_invitee_id uuid,
  target_album_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with expired as (
    update public.shared_album_invitations invitation
      set status = 'expired', responded_at = now()
      where invitation.invitee_id = target_invitee_id
        and invitation.status = 'pending'
        and invitation.expires_at <= now()
        and (target_album_id is null or invitation.album_id = target_album_id)
      returning invitation.id
  )
  update public.notifications notification
    set read_at = coalesce(notification.read_at, now())
    where notification.invitation_id in (select expired.id from expired);
end;
$$;

revoke all on function private.expire_shared_album_invitations(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.invite_to_shared_album(
  target_album_id uuid,
  invitee_email text
)
returns table (
  invitation_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_user_id uuid;
  new_invitation_id uuid;
  new_expires_at timestamptz := now() + interval '7 days';
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if target_album_id is null then
    raise exception 'shared album is required' using errcode = '22023';
  end if;

  perform 1
    from public.shared_albums album
    where album.id = target_album_id
      and album.owner_id = caller_id
    for update;

  if not found then
    raise exception 'only the shared album owner can invite users'
      using errcode = '42501';
  end if;

  if invitee_email is null or btrim(invitee_email) = '' then
    raise exception 'invitee email is required' using errcode = '22023';
  end if;

  select account.id
    into target_user_id
    from auth.users account
    where account.email is not null
      and lower(account.email) = lower(btrim(invitee_email))
    order by account.created_at, account.id
    limit 1;

  if target_user_id is null then
    raise exception 'registered account not found' using errcode = 'P0002';
  end if;

  if target_user_id = caller_id then
    raise exception 'owners cannot invite themselves' using errcode = '22023';
  end if;

  perform private.expire_shared_album_invitations(target_user_id, target_album_id);

  if exists (
    select 1
      from public.shared_album_members membership
      where membership.album_id = target_album_id
        and membership.user_id = target_user_id
  ) then
    raise exception 'user is already a shared album member' using errcode = '23505';
  end if;

  begin
    insert into public.shared_album_invitations (
      album_id,
      inviter_id,
      invitee_id,
      status,
      created_at,
      expires_at
    )
    values (
      target_album_id,
      caller_id,
      target_user_id,
      'pending',
      new_expires_at - interval '7 days',
      new_expires_at
    )
    returning id into new_invitation_id;
  exception
    when unique_violation then
      raise exception 'pending invitation already exists' using errcode = '23505';
  end;

  insert into public.notifications (recipient_id, type, invitation_id, created_at)
  values (target_user_id, 'shared_album_invitation', new_invitation_id, now());

  invitation_id := new_invitation_id;
  expires_at := new_expires_at;
  return next;
end;
$$;

revoke all on function public.invite_to_shared_album(uuid, text)
  from public, anon, authenticated;
grant execute on function public.invite_to_shared_album(uuid, text) to authenticated;

create or replace function public.respond_to_shared_album_invitation(
  target_invitation_id uuid,
  response text
)
returns table (
  album_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_album uuid;
  current_status text;
  invitation_expiry timestamptz;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if response not in ('accepted', 'declined') then
    raise exception 'response must be accepted or declined' using errcode = '22023';
  end if;

  select invitation.album_id
    into target_album
    from public.shared_album_invitations invitation
    where invitation.id = target_invitation_id
      and invitation.invitee_id = caller_id;

  if target_album is null then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  perform 1
    from public.shared_albums album
    where album.id = target_album
    for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  select invitation.status, invitation.expires_at
    into current_status, invitation_expiry
    from public.shared_album_invitations invitation
    where invitation.id = target_invitation_id
      and invitation.invitee_id = caller_id
    for update;

  if current_status is null then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if current_status = 'pending' and invitation_expiry <= now() then
    update public.shared_album_invitations invitation
      set status = 'expired', responded_at = now()
      where invitation.id = target_invitation_id;
    update public.notifications notification
      set read_at = coalesce(notification.read_at, now())
      where notification.invitation_id = target_invitation_id;

    album_id := target_album;
    status := 'expired';
    return next;
    return;
  end if;

  if current_status = response then
    update public.notifications notification
      set read_at = coalesce(notification.read_at, now())
      where notification.invitation_id = target_invitation_id;
    album_id := target_album;
    status := current_status;
    return next;
    return;
  end if;

  if current_status <> 'pending' then
    raise exception 'invitation has already been resolved' using errcode = '22023';
  end if;

  if response = 'accepted' then
    insert into public.shared_album_members (album_id, user_id, role, joined_at)
    values (target_album, caller_id, 'member', now())
    on conflict (album_id, user_id) do nothing;
  end if;

  update public.shared_album_invitations invitation
    set status = response, responded_at = now()
    where invitation.id = target_invitation_id;

  update public.notifications notification
    set read_at = coalesce(notification.read_at, now())
    where notification.invitation_id = target_invitation_id;

  album_id := target_album;
  status := response;
  return next;
end;
$$;

revoke all on function public.respond_to_shared_album_invitation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.respond_to_shared_album_invitation(uuid, text) to authenticated;

create or replace function public.list_my_invitation_notifications()
returns table (
  notification_id uuid,
  invitation_id uuid,
  album_id uuid,
  album_name text,
  inviter_display_name text,
  invitation_status text,
  created_at timestamptz,
  expires_at timestamptz,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return;
  end if;

  perform private.expire_shared_album_invitations(caller_id, null);

  return query
    select
      notification.id,
      invitation.id,
      album.id,
      album.name,
      coalesce(profile.display_name, 'メンバー'),
      invitation.status,
      notification.created_at,
      invitation.expires_at,
      notification.read_at
    from public.notifications notification
    join public.shared_album_invitations invitation
      on invitation.id = notification.invitation_id
    join public.shared_albums album
      on album.id = invitation.album_id
    left join public.profiles profile
      on profile.id = invitation.inviter_id
    where notification.recipient_id = caller_id
      and invitation.invitee_id = caller_id
    order by notification.created_at desc, notification.id desc;
end;
$$;

revoke all on function public.list_my_invitation_notifications()
  from public, anon, authenticated;
grant execute on function public.list_my_invitation_notifications() to authenticated;

create or replace function public.get_unread_invitation_notification_count()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  unread_count bigint;
begin
  if caller_id is null then
    return 0;
  end if;

  perform private.expire_shared_album_invitations(caller_id, null);

  select count(*)
    into unread_count
    from public.notifications notification
    join public.shared_album_invitations invitation
      on invitation.id = notification.invitation_id
    where notification.recipient_id = caller_id
      and invitation.invitee_id = caller_id
      and notification.read_at is null
      and invitation.status = 'pending'
      and invitation.expires_at > now();

  return unread_count;
end;
$$;

revoke all on function public.get_unread_invitation_notification_count()
  from public, anon, authenticated;
grant execute on function public.get_unread_invitation_notification_count() to authenticated;
