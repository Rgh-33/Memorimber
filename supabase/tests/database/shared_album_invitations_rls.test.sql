begin;

select plan(51);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'owner@example.com', '{"display_name":"オーナー"}'),
  ('20000000-0000-0000-0000-000000000002', 'member@example.com', '{"display_name":"メンバー"}'),
  ('30000000-0000-0000-0000-000000000003', 'Friend@Example.com', '{"display_name":"承認する人"}'),
  ('40000000-0000-0000-0000-000000000004', 'decline@example.com', '{"display_name":"辞退する人"}'),
  ('50000000-0000-0000-0000-000000000005', 'expired@example.com', '{"display_name":"期限切れの人"}'),
  ('60000000-0000-0000-0000-000000000006', 'outsider@example.com', '{"display_name":"部外者"}');

insert into public.shared_albums (id, owner_id, name)
values (
  '70000000-0000-4000-8000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  '家族のグループ'
);

insert into public.shared_album_members (album_id, user_id, role)
values (
  '70000000-0000-4000-8000-000000000007',
  '20000000-0000-0000-0000-000000000002',
  'member'
);

select is_empty(
  $$select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('shared_album_invitations', 'notifications')
      and column_name like '%email%'$$,
  'invitation and notification tables do not store email addresses'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      '  FRIEND@example.COM  '
    )$$,
  'the owner can invite a registered account with case-insensitive exact email matching'
);

reset role;

select results_eq(
  $$select invitee_id from public.shared_album_invitations
    where album_id = '70000000-0000-4000-8000-000000000007'$$,
  $$values ('30000000-0000-0000-0000-000000000003'::uuid)$$,
  'the invitation stores only the resolved account id'
);

select results_eq(
  $$select expires_at - created_at from public.shared_album_invitations
    where invitee_id = '30000000-0000-0000-0000-000000000003'$$,
  $$values (interval '7 days')$$,
  'an invitation expires exactly seven days after creation'
);

select results_eq(
  $$select count(*)::bigint from public.notifications notification
    join public.shared_album_invitations invitation on invitation.id = notification.invitation_id
    where invitation.invitee_id = '30000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$,
  'one invitation creates exactly one notification'
);

select set_config(
  'test.accept_invitation',
  (select id::text from public.shared_album_invitations where invitee_id = '30000000-0000-0000-0000-000000000003'),
  true
);
select set_config(
  'test.accept_notification',
  (select id::text from public.notifications where invitation_id = current_setting('test.accept_invitation')::uuid),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'friend@example.com'
    )$$,
  '23505',
  null,
  'a duplicate pending invitation is rejected'
);

select throws_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'owner@example.com'
    )$$,
  '22023',
  null,
  'the owner cannot invite themselves'
);

select throws_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'missing@example.com'
    )$$,
  'P0002',
  null,
  'an unregistered email address is rejected'
);

select throws_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'member@example.com'
    )$$,
  '23505',
  null,
  'an existing member cannot be invited again'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'decline@example.com'
    )$$,
  '42501',
  null,
  'a non-owner member cannot invite users'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select results_eq(
  $$select id from public.shared_album_invitations$$,
  $$values (current_setting('test.accept_invitation')::uuid)$$,
  'the invitee can view their own invitation'
);

select results_eq(
  $$select id from public.notifications$$,
  $$values (current_setting('test.accept_notification')::uuid)$$,
  'the recipient can view their own notification'
);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (1::bigint)$$,
  'the pending notification contributes to the invitees unread count'
);

select results_eq(
  $$select album_name from public.list_my_invitation_notifications()$$,
  $$values ('家族のグループ'::text)$$,
  'the invitee notification RPC returns the private album name'
);

select results_eq(
  $$select inviter_display_name from public.list_my_invitation_notifications()$$,
  $$values ('オーナー'::text)$$,
  'the notification RPC returns display name instead of email'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is_empty(
  $$select id from public.shared_album_invitations$$,
  'even the owner cannot directly view another users invitation row'
);

select is_empty(
  $$select id from public.notifications$$,
  'the owner cannot view another users notification'
);

select throws_ok(
  $$select * from public.respond_to_shared_album_invitation(
      current_setting('test.accept_invitation')::uuid,
      'accepted'
    )$$,
  'P0002',
  null,
  'the owner cannot respond to the invitees invitation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000006', true);

select is_empty(
  $$select id from public.shared_album_invitations$$,
  'an unrelated user cannot view invitations'
);

select is_empty(
  $$select id from public.notifications$$,
  'an unrelated user cannot view notifications'
);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (0::bigint)$$,
  'an unrelated user has no unread notifications'
);

select is_empty(
  $$select * from public.list_my_invitation_notifications()$$,
  'an unrelated user receives no rows from the notification RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);

select results_eq(
  $$select status from public.respond_to_shared_album_invitation(
      current_setting('test.accept_invitation')::uuid,
      'accepted'
    )$$,
  $$values ('accepted'::text)$$,
  'the invitee can accept a pending invitation'
);

select results_eq(
  $$select role from public.shared_album_members
    where album_id = '70000000-0000-4000-8000-000000000007'
      and user_id = '30000000-0000-0000-0000-000000000003'$$,
  $$values ('member'::text)$$,
  'acceptance atomically adds a formal member'
);

select results_eq(
  $$select status from public.shared_album_invitations
    where id = current_setting('test.accept_invitation')::uuid$$,
  $$values ('accepted'::text)$$,
  'acceptance atomically updates invitation status'
);

select results_eq(
  $$select (read_at is not null) from public.notifications
    where id = current_setting('test.accept_notification')::uuid$$,
  $$values (true)$$,
  'acceptance atomically marks its notification read'
);

select results_eq(
  $$select status from public.respond_to_shared_album_invitation(
      current_setting('test.accept_invitation')::uuid,
      'accepted'
    )$$,
  $$values ('accepted'::text)$$,
  'repeating the same acceptance is idempotent'
);

select results_eq(
  $$select count(*)::bigint from public.shared_album_members
    where album_id = '70000000-0000-4000-8000-000000000007'
      and user_id = '30000000-0000-0000-0000-000000000003'$$,
  $$values (1::bigint)$$,
  'repeated acceptance does not duplicate membership'
);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (0::bigint)$$,
  'an accepted invitation is removed from unread count'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'decline@example.com'
    )$$,
  'the owner can create a second invitation'
);

reset role;
select set_config(
  'test.decline_invitation',
  (select id::text from public.shared_album_invitations where invitee_id = '40000000-0000-0000-0000-000000000004'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);

select results_eq(
  $$select status from public.respond_to_shared_album_invitation(
      current_setting('test.decline_invitation')::uuid,
      'declined'
    )$$,
  $$values ('declined'::text)$$,
  'the invitee can decline a pending invitation'
);

select is_empty(
  $$select user_id from public.shared_album_members
    where album_id = '70000000-0000-4000-8000-000000000007'
      and user_id = '40000000-0000-0000-0000-000000000004'$$,
  'declining does not add membership'
);

select results_eq(
  $$select status from public.shared_album_invitations
    where id = current_setting('test.decline_invitation')::uuid$$,
  $$values ('declined'::text)$$,
  'declining updates invitation status'
);

select results_eq(
  $$select (read_at is not null) from public.notifications
    where invitation_id = current_setting('test.decline_invitation')::uuid$$,
  $$values (true)$$,
  'declining marks its notification read'
);

select results_eq(
  $$select status from public.respond_to_shared_album_invitation(
      current_setting('test.decline_invitation')::uuid,
      'declined'
    )$$,
  $$values ('declined'::text)$$,
  'repeating the same decline is idempotent'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'expired@example.com'
    )$$,
  'the owner can create an invitation used for expiry checks'
);

reset role;

update public.shared_album_invitations
set
  created_at = now() - interval '8 days',
  expires_at = now() - interval '1 day'
where invitee_id = '50000000-0000-0000-0000-000000000005';

select set_config(
  'test.expired_invitation',
  (select id::text from public.shared_album_invitations where invitee_id = '50000000-0000-0000-0000-000000000005'),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', true);

select results_eq(
  $$select status from public.respond_to_shared_album_invitation(
      current_setting('test.expired_invitation')::uuid,
      'accepted'
    )$$,
  $$values ('expired'::text)$$,
  'an expired invitation cannot be accepted and resolves as expired'
);

select is_empty(
  $$select user_id from public.shared_album_members
    where album_id = '70000000-0000-4000-8000-000000000007'
      and user_id = '50000000-0000-0000-0000-000000000005'$$,
  'expiry does not add membership'
);

select results_eq(
  $$select status from public.shared_album_invitations
    where id = current_setting('test.expired_invitation')::uuid$$,
  $$values ('expired'::text)$$,
  'the expired status is persisted'
);

select results_eq(
  $$select (read_at is not null) from public.notifications
    where invitation_id = current_setting('test.expired_invitation')::uuid$$,
  $$values (true)$$,
  'expiry marks the old notification read'
);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (0::bigint)$$,
  'expired invitations are excluded from unread count'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select * from public.invite_to_shared_album(
      '70000000-0000-4000-8000-000000000007',
      'expired@example.com'
    )$$,
  'an owner can re-invite after the old invitation expires'
);

reset role;

select results_eq(
  $$select count(*)::bigint from public.shared_album_invitations
    where invitee_id = '50000000-0000-0000-0000-000000000005'
      and status = 'pending'$$,
  $$values (1::bigint)$$,
  're-inviting creates exactly one new pending invitation'
);

select results_eq(
  $$select count(*)::bigint from public.notifications notification
    join public.shared_album_invitations invitation on invitation.id = notification.invitation_id
    where invitation.invitee_id = '50000000-0000-0000-0000-000000000005'$$,
  $$values (2::bigint)$$,
  'each old and new invitation has exactly one notification'
);

select set_config(
  'test.reinvite_notification',
  (
    select notification.id::text
      from public.notifications notification
      join public.shared_album_invitations invitation on invitation.id = notification.invitation_id
      where invitation.invitee_id = '50000000-0000-0000-0000-000000000005'
        and invitation.status = 'pending'
  ),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', true);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (1::bigint)$$,
  'the re-invitation contributes one unread notification'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000006', true);

select is_empty(
  $$update public.notifications set read_at = now()
    where id = current_setting('test.reinvite_notification')::uuid
    returning id$$,
  'another user cannot mark the recipients notification read'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000005', true);

select results_eq(
  $$update public.notifications set read_at = now()
    where id = current_setting('test.reinvite_notification')::uuid
    returning id$$,
  $$values (current_setting('test.reinvite_notification')::uuid)$$,
  'the recipient can mark their own notification read'
);

select results_eq(
  $$select public.get_unread_invitation_notification_count()$$,
  $$values (0::bigint)$$,
  'marking all current notifications read clears the unread count'
);

select throws_ok(
  $$update public.notifications set read_at = null
    where id = current_setting('test.reinvite_notification')::uuid$$,
  '23514',
  null,
  'a read notification cannot be made unread again'
);

select throws_ok(
  $$update public.shared_album_invitations set status = 'accepted'
    where id = current_setting('test.expired_invitation')::uuid$$,
  '42501',
  null,
  'clients cannot directly alter invitation status'
);

select throws_ok(
  $$insert into public.notifications (recipient_id, type, invitation_id)
    values (
      '50000000-0000-0000-0000-000000000005',
      'shared_album_invitation',
      current_setting('test.expired_invitation')::uuid
    )$$,
  '42501',
  null,
  'clients cannot forge notifications'
);

select * from finish();
rollback;
