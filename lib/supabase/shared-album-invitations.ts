import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InvitationResponse = "accepted" | "declined";
export type InvitationStatus = "pending" | InvitationResponse | "expired";

export type InvitationNotification = {
  notificationId: string;
  invitationId: string;
  albumId: string;
  albumName: string;
  inviterDisplayName: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  readAt: string | null;
};

type RpcError = { message?: string } | null;

function requireUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label}が正しくありません。`);
  return value;
}

export function normalizeInvitationEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email.length > 320 || !email.includes("@") || /\s/.test(email)) {
    throw new Error("登録済みのメールアドレスを入力してください。");
  }
  return email;
}

function invitationError(error: RpcError, fallback: string) {
  const message = error?.message ?? "";
  if (message.includes("only the shared album owner")) return "招待できるのはグループのオーナーだけです。";
  if (message.includes("registered account not found")) return "そのメールアドレスの登録済みアカウントが見つかりません。";
  if (message.includes("owners cannot invite themselves")) return "自分自身は招待できません。";
  if (message.includes("already a shared album member")) return "そのユーザーはすでにメンバーです。";
  if (message.includes("pending invitation already exists")) return "そのユーザーにはすでに招待を送っています。";
  if (message.includes("invitation has already been resolved")) return "この招待にはすでに回答済みです。";
  if (message.includes("invitation not found")) return "招待が見つからないか、回答する権限がありません。";
  return fallback;
}

function firstRow<T>(data: T[] | T | null): T | null {
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function inviteToSharedAlbum(
  client: SupabaseClient,
  albumId: string,
  emailInput: unknown,
) {
  const email = normalizeInvitationEmail(emailInput);
  const { data, error } = await client.rpc("invite_to_shared_album", {
    target_album_id: requireUuid(albumId, "グループ"),
    invitee_email: email,
  });
  if (error) throw new Error(invitationError(error, "招待を送信できませんでした。"));

  const row = firstRow(data as { invitation_id?: unknown; expires_at?: unknown }[] | null);
  if (!row || typeof row.invitation_id !== "string" || typeof row.expires_at !== "string") {
    throw new Error("招待の保存結果を確認できませんでした。");
  }
  return { invitationId: row.invitation_id, expiresAt: row.expires_at };
}

export async function respondToSharedAlbumInvitation(
  client: SupabaseClient,
  invitationId: string,
  response: InvitationResponse,
) {
  if (response !== "accepted" && response !== "declined") {
    throw new Error("招待への回答が正しくありません。");
  }
  const { data, error } = await client.rpc("respond_to_shared_album_invitation", {
    target_invitation_id: requireUuid(invitationId, "招待"),
    response,
  });
  if (error) throw new Error(invitationError(error, "招待へ回答できませんでした。"));

  const row = firstRow(data as { album_id?: unknown; status?: unknown }[] | null);
  if (!row || typeof row.album_id !== "string" || !isInvitationStatus(row.status)) {
    throw new Error("招待への回答結果を確認できませんでした。");
  }
  return { albumId: row.album_id, status: row.status };
}

function isInvitationStatus(value: unknown): value is InvitationStatus {
  return value === "pending" || value === "accepted" || value === "declined" || value === "expired";
}

export async function listInvitationNotifications(client: SupabaseClient): Promise<InvitationNotification[]> {
  const { data, error } = await client.rpc("list_my_invitation_notifications");
  if (error) throw new Error("通知を読み込めませんでした。");

  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((raw): InvitationNotification[] => {
    const row = raw as Record<string, unknown>;
    if (
      typeof row.notification_id !== "string"
      || typeof row.invitation_id !== "string"
      || typeof row.album_id !== "string"
      || typeof row.album_name !== "string"
      || typeof row.inviter_display_name !== "string"
      || !isInvitationStatus(row.invitation_status)
      || typeof row.created_at !== "string"
      || typeof row.expires_at !== "string"
      || (row.read_at !== null && typeof row.read_at !== "string")
    ) return [];

    return [{
      notificationId: row.notification_id,
      invitationId: row.invitation_id,
      albumId: row.album_id,
      albumName: row.album_name,
      inviterDisplayName: row.inviter_display_name,
      status: row.invitation_status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      readAt: row.read_at,
    }];
  });
}

export async function getUnreadInvitationNotificationCount(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_unread_invitation_notification_count");
  if (error) throw new Error("未読通知を確認できませんでした。");
  const count = typeof data === "number" ? data : Number(data);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export async function markAllInvitationNotificationsRead(
  client: SupabaseClient,
  userId: string,
) {
  const { error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", requireUuid(userId, "ユーザー"))
    .is("read_at", null);
  if (error) throw new Error("通知を既読にできませんでした。");
}
