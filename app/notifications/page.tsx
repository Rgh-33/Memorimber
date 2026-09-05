import Link from "next/link";
import { Bell, ChevronRight, MailOpen } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listInvitationNotifications, type InvitationNotification } from "@/lib/supabase/shared-album-invitations";
import { createClient } from "@/lib/supabase/server";
import { MarkAllReadButton } from "./mark-all-read-button";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

const statusLabels: Record<InvitationNotification["status"], string> = {
  pending: "回答待ち",
  accepted: "参加済み",
  declined: "辞退済み",
  expired: "期限切れ",
};

export default async function NotificationsPage() {
  let notifications: InvitationNotification[] = [];
  let loadError: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      notifications = await listInvitationNotifications(await createClient());
    } catch (error) {
      loadError = error instanceof Error ? error.message : "通知を読み込めませんでした。";
    }
  }

  const hasUnread = notifications.some((notification) => notification.readAt === null && notification.status === "pending");

  return (
    <div className="page-pad">
      <section className="pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">NOTIFICATIONS</p>
            <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">通知</h1>
          </div>
          <MarkAllReadButton disabled={!hasUnread} />
        </div>
        <p className="mt-3 text-xs leading-6 text-ink/50">共有グループへの招待を確認できます。</p>
      </section>

      {loadError ? (
        <section role="alert" className="mt-7 rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-xs leading-6 text-red-700">
          {loadError}
        </section>
      ) : notifications.length === 0 ? (
        <section className="mt-12 grid justify-items-center gap-3 text-center text-ink/40">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-paper"><MailOpen size={21} /></span>
          <p className="text-xs leading-6">新しい通知はありません。</p>
        </section>
      ) : (
        <ol className="mt-7 grid gap-3">
          {notifications.map((notification) => {
            const unread = notification.readAt === null && notification.status === "pending";
            return (
              <li key={notification.notificationId}>
                <Link
                  href={`/shared-groups?invitation=${encodeURIComponent(notification.invitationId)}`}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-4 shadow-sm transition hover:border-coral"
                >
                  <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral">
                    <Bell size={18} strokeWidth={1.7} />
                    {unread ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-paper bg-coral" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{notification.albumName}</span>
                    <span className="mt-1 block text-[11px] leading-5 text-ink/55">
                      {notification.inviterDisplayName}さんから招待されました
                    </span>
                    <span className="mt-1 block text-[10px] text-ink/40">
                      {dateFormatter.format(new Date(notification.createdAt))} · {statusLabels[notification.status]}
                      {notification.status === "pending" ? ` · ${dateFormatter.format(new Date(notification.expiresAt))}まで` : ""}
                    </span>
                  </span>
                  <ChevronRight size={17} className="shrink-0 text-ink/30" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
