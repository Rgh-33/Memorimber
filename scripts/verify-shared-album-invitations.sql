-- Run against the linked Supabase database as postgres; no extensions required.
-- All fixtures live in an exception subtransaction. The final PZ101 rolls them
-- back on success; any unexpected error aborts the statement and also rolls back.
do $$
declare
  test_users uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  test_album uuid := gen_random_uuid();
  test_invitations uuid[] := array[]::uuid[];
  invitation_result record;
  response_result record;
  test_case integer;
  expected_status text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
      select fixture.id, 'invitation-smoke-' || fixture.id::text || '@example.invalid',
        '{"display_name":"Invitation test"}'::jsonb, now(), now()
      from unnest(test_users) as fixture(id);
    insert into public.shared_albums (id, owner_id, name)
      values (test_album, test_users[1], 'Invitation smoke test');

    -- The owner creates all three invitations through the real authenticated RPC.
    perform set_config('request.jwt.claim.sub', test_users[1]::text, true);
    set local role authenticated;
    for test_case in 2..4 loop
      select * into strict invitation_result
        from public.invite_to_shared_album(
          test_album, 'invitation-smoke-' || test_users[test_case]::text || '@example.invalid'
        );
      test_invitations[test_case] := invitation_result.invitation_id;
      if invitation_result.invitation_id is null
        or invitation_result.expires_at is distinct from now() + interval '7 days' then
        raise exception 'Owner invitation returned an invalid result';
      end if;
    end loop;
    reset role;

    if (select count(*) from public.shared_album_invitations invitation
        where invitation.album_id = test_album and invitation.inviter_id = test_users[1]
          and invitation.status = 'pending' and invitation.responded_at is null) <> 3
      or (select count(*) from public.notifications notification
        where notification.invitation_id = any(test_invitations) and notification.read_at is null) <> 3 then
      raise exception 'Owner invitations did not create pending invitations and unread notifications';
    end if;

    -- The owner is not the recipient and must be denied without changing state.
    set local role authenticated;
    begin
      perform public.respond_to_shared_album_invitation(test_invitations[2], 'accepted');
      raise exception 'A non-recipient was allowed to answer an invitation';
    exception when sqlstate 'P0002' then
      null;
    end;
    reset role;
    if not exists (select 1 from public.shared_album_invitations invitation
        where invitation.id = test_invitations[2] and invitation.status = 'pending'
          and invitation.responded_at is null)
      or not exists (select 1 from public.notifications notification
        where notification.invitation_id = test_invitations[2] and notification.read_at is null)
      or (select count(*) from public.shared_album_members membership
        where membership.album_id = test_album) <> 1 then
      raise exception 'A denied response changed invitation, notification, or membership state';
    end if;

    -- Accept twice, decline separately, and accept an expired invitation.
    foreach test_case in array array[2, 2, 3, 4] loop
      expected_status := case test_case when 2 then 'accepted' when 3 then 'declined' else 'expired' end;
      if test_case = 4 then
        update public.shared_album_invitations invitation
          set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
          where invitation.id = test_invitations[4];
      end if;

      perform set_config('request.jwt.claim.sub', test_users[test_case]::text, true);
      set local role authenticated;
      select * into strict response_result
        from public.respond_to_shared_album_invitation(
          test_invitations[test_case], case when test_case = 3 then 'declined' else 'accepted' end
        );
      reset role;

      if response_result.album_id is distinct from test_album
        or response_result.status is distinct from expected_status then
        raise exception 'Invitation response did not return the expected album and status: %', expected_status;
      end if;
      if not exists (select 1 from public.shared_album_invitations invitation
          where invitation.id = test_invitations[test_case] and invitation.status = expected_status
            and invitation.responded_at is not null)
        or not exists (select 1 from public.notifications notification
          where notification.invitation_id = test_invitations[test_case]
            and notification.recipient_id = test_users[test_case] and notification.read_at is not null) then
        raise exception 'Invitation response did not persist its status, response time, and read notification: %', expected_status;
      end if;
      if (select count(*) from public.shared_album_members membership
          where membership.album_id = test_album and membership.user_id = test_users[test_case])
        <> (case when test_case = 2 then 1 else 0 end) then
        raise exception 'Invitation response produced an incorrect membership count: %', expected_status;
      end if;
      if test_case = 2 and not exists (select 1 from public.shared_album_members membership
          where membership.album_id = test_album and membership.user_id = test_users[2]
            and membership.role = 'member' and membership.joined_at is not null) then
        raise exception 'Accepted invitation did not create a regular member';
      end if;
    end loop;

    if (select count(*) from public.shared_album_members membership
        where membership.album_id = test_album) <> 2 then
      raise exception 'Final album membership does not contain exactly the owner and accepted invitee';
    end if;

    raise sqlstate 'PZ101' using message = 'Roll back successful smoke-test fixtures';
  exception when sqlstate 'PZ101' then
    null;
  end;

  -- PL/pgSQL variables retain the generated IDs after the fixture rollback.
  if exists (select 1 from auth.users account where account.id = any(test_users))
    or exists (select 1 from public.profiles profile where profile.id = any(test_users))
    or exists (select 1 from public.shared_albums album where album.id = test_album)
    or exists (select 1 from public.shared_album_members membership where membership.album_id = test_album)
    or exists (select 1 from public.shared_album_invitations invitation where invitation.album_id = test_album)
    or exists (select 1 from public.notifications notification where notification.invitation_id = any(test_invitations)) then
    raise exception 'Smoke-test fixtures remained after rollback';
  end if;
end;
$$;

select 'Shared album invitation checks passed; all fixtures rolled back' as result;
