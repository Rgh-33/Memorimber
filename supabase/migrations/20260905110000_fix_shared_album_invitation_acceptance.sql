-- Name the conflict constraint to avoid ambiguity with RETURNS TABLE's album_id.
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
    on conflict on constraint shared_album_members_pkey do nothing;
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
