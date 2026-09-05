import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getUnreadInvitationNotificationCount,
  inviteToSharedAlbum,
  listInvitationNotifications,
  markAllInvitationNotificationsRead,
  normalizeInvitationEmail,
  respondToSharedAlbumInvitation,
} from "../lib/supabase/shared-album-invitations.ts";

const ALBUM_ID = "11111111-1111-4111-8111-111111111111";
const INVITATION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function harness({ rpc = {}, updateError = null } = {}) {
  const calls = [];
  return {
    calls,
    client: {
      async rpc(name, args) {
        calls.push({ method: "rpc", name, args });
        return rpc[name] ?? { data: null, error: null };
      },
      from(table) {
        calls.push({ method: "from", table });
        const query = {
          update(payload) { calls.push({ method: "update", payload }); return query; },
          eq(column, value) { calls.push({ method: "eq", column, value }); return query; },
          async is(column, value) {
            calls.push({ method: "is", column, value });
            return { error: updateError };
          },
        };
        return query;
      },
    },
  };
}

test("invitation email normalization is case-insensitive without accepting malformed input", () => {
  assert.equal(normalizeInvitationEmail("  Friend@Example.COM "), "friend@example.com");
  for (const invalid of [null, "", "no-at-sign", "two words@example.com", `${"a".repeat(315)}@x.com`]) {
    assert.throws(() => normalizeInvitationEmail(invalid), /登録済みのメールアドレス/);
  }
});

test("inviting sends only normalized email and album id to the restricted RPC", async () => {
  const h = harness({ rpc: {
    invite_to_shared_album: {
      data: [{ invitation_id: INVITATION_ID, expires_at: "2026-09-12T00:00:00Z" }],
      error: null,
    },
  } });
  const result = await inviteToSharedAlbum(h.client, ALBUM_ID, " Friend@Example.COM ");
  assert.deepEqual(result, { invitationId: INVITATION_ID, expiresAt: "2026-09-12T00:00:00Z" });
  assert.deepEqual(h.calls[0], {
    method: "rpc",
    name: "invite_to_shared_album",
    args: { target_album_id: ALBUM_ID, invitee_email: "friend@example.com" },
  });

  await assert.rejects(
    inviteToSharedAlbum(harness({ rpc: { invite_to_shared_album: { data: null, error: { message: "registered account not found" } } } }).client, ALBUM_ID, "missing@example.com"),
    /登録済みアカウントが見つかりません/,
  );
});

test("accepting, declining, and expired responses are mapped without email data", async () => {
  for (const status of ["accepted", "declined", "expired"]) {
    const h = harness({ rpc: {
      respond_to_shared_album_invitation: { data: [{ album_id: ALBUM_ID, status }], error: null },
    } });
    const requested = status === "declined" ? "declined" : "accepted";
    assert.deepEqual(await respondToSharedAlbumInvitation(h.client, INVITATION_ID, requested), { albumId: ALBUM_ID, status });
    assert.deepEqual(h.calls[0].args, { target_invitation_id: INVITATION_ID, response: requested });
  }
});

test("notification listing accepts only the safe RPC response shape", async () => {
  const h = harness({ rpc: {
    list_my_invitation_notifications: {
      data: [{
        notification_id: "44444444-4444-4444-8444-444444444444",
        invitation_id: INVITATION_ID,
        album_id: ALBUM_ID,
        album_name: "家族",
        inviter_display_name: "メモリさん",
        invitation_status: "pending",
        created_at: "2026-09-05T00:00:00Z",
        expires_at: "2026-09-12T00:00:00Z",
        read_at: null,
        inviter_email: "must-not-be-mapped@example.com",
      }, { malformed: true }],
      error: null,
    },
  } });
  const notifications = await listInvitationNotifications(h.client);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].albumName, "家族");
  assert.equal("inviterEmail" in notifications[0], false);
});

test("unread counts and all-read updates stay scoped to the authenticated recipient", async () => {
  const countHarness = harness({ rpc: {
    get_unread_invitation_notification_count: { data: 3, error: null },
  } });
  assert.equal(await getUnreadInvitationNotificationCount(countHarness.client), 3);

  const updateHarness = harness();
  await markAllInvitationNotificationsRead(updateHarness.client, USER_ID);
  assert.ok(updateHarness.calls.some((call) => call.method === "from" && call.table === "notifications"));
  assert.ok(updateHarness.calls.some((call) => call.method === "eq" && call.column === "recipient_id" && call.value === USER_ID));
  assert.ok(updateHarness.calls.some((call) => call.method === "is" && call.column === "read_at" && call.value === null));
});

test("invitation migration keeps email private and enforces lifecycle and RLS", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260905020000_create_shared_album_invitations.sql", import.meta.url), "utf8");
  assert.match(sql, /create table public\.shared_album_invitations[\s\S]*status in \('pending', 'accepted', 'declined', 'expired'\)/);
  assert.match(sql, /expires_at = created_at \+ interval '7 days'/);
  assert.match(sql, /shared_album_invitations_one_pending_idx[\s\S]*where status = 'pending'/);
  assert.match(sql, /create table public\.notifications[\s\S]*invitation_id uuid not null unique/);
  assert.doesNotMatch(sql, /create table public\.(?:shared_album_invitations|notifications)[\s\S]*\bemail\s+(?:text|varchar)/i);
  assert.match(sql, /lower\(account\.email\) = lower\(btrim\(invitee_email\)\)/);
  assert.match(sql, /only the shared album owner can invite users/);
  assert.match(sql, /insert into public\.shared_album_members[\s\S]*set status = response[\s\S]*set read_at = coalesce/);
  assert.match(sql, /Invitees can view their own shared album invitations[\s\S]*invitee_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /Recipients can view their own notifications[\s\S]*recipient_id = \(select auth\.uid\(\)\)/);
  assert.doesNotMatch(sql, /grant (?:insert|delete)[^;]*public\.(?:shared_album_invitations|notifications)[^;]*authenticated/i);

  for (const name of [
    "invite_to_shared_album",
    "respond_to_shared_album_invitation",
    "list_my_invitation_notifications",
    "get_unread_invitation_notification_count",
  ]) {
    assert.match(sql, new RegExp(`function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name}\\(`));
  }
});

test("notification UI exposes the menu indicator, safe list, and all-read control", () => {
  const header = readFileSync(new URL("../components/app-header.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/notifications/page.tsx", import.meta.url), "utf8");
  const providers = readFileSync(new URL("../app/providers.tsx", import.meta.url), "utf8");
  assert.match(header, /未読通知\$\{unreadCount\}件/);
  assert.match(header, /href="\/notifications"/);
  assert.match(header, /unreadCount > 99 \? "99\+" : unreadCount/);
  assert.match(page, /href=\{`\/shared-groups\?invitation=\$\{encodeURIComponent\(notification\.invitationId\)\}`\}/);
  assert.match(page, /<MarkAllReadButton disabled=\{!hasUnread\}/);
  assert.match(providers, /<NotificationsProvider>/);
  assert.doesNotMatch(page, /\.email\b|email:/);
});
