import Link from "next/link";
import { ChevronRight, Mail, Plus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listInvitationNotifications, type InvitationNotification } from "@/lib/supabase/shared-album-invitations";
import { listSharedAlbums, type SharedAlbum } from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";
import { createSharedGroupAction, respondInvitationAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SharedGroupsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const highlightedInvitation = typeof query.invitation === "string" ? query.invitation : null;
  const success = typeof query.success === "string" ? query.success : null;
  const actionError = typeof query.error === "string" ? query.error : null;
  const configured = isSupabaseConfigured();
  let albums: SharedAlbum[] = [];
  let invitations: InvitationNotification[] = [];
  let loadError: string | null = null;

  if (configured) {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) redirect(`/login?${new URLSearchParams({ next: "/shared-groups" })}`);
    const [albumResult, invitationResult] = await Promise.allSettled([
      listSharedAlbums(client),
      listInvitationNotifications(client),
    ]);
    if (albumResult.status === "fulfilled") albums = albumResult.value;
    else loadError = albumResult.reason instanceof Error ? albumResult.reason.message : "グループを読み込めませんでした。";
    if (invitationResult.status === "fulfilled") {
      invitations = invitationResult.value.filter((invitation) => invitation.status === "pending");
    } else {
      loadError ??= invitationResult.reason instanceof Error ? invitationResult.reason.message : "招待を読み込めませんでした。";
    }
  }

  return (
    <div className="page-pad">
      <AppHeader />
      <section className="pt-8">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-coral">SHARED GROUPS</p>
        <h1 className="mt-2 text-[25px] font-semibold tracking-[0.1em] text-ink">共有</h1>
        <p className="mt-3 text-xs leading-6 text-ink/50">大切な人と、選んだ思い出だけを一緒に見られます。</p>
      </section>

      {!configured ? <p role="alert" className="auth-notice auth-notice--info mt-6">Supabaseの接続情報が設定されていません。</p> : null}
      {success ? <p role="status" className="auth-notice auth-notice--success mt-6">{success}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {loadError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{loadError}</p> : null}

      <section className="mt-7" aria-labelledby="pending-invitations-title">
        <div className="flex items-center justify-between">
          <h2 id="pending-invitations-title" className="text-sm font-semibold text-ink">届いている招待</h2>
          <span className="text-[11px] text-ink/40">{invitations.length}件</span>
        </div>
        {invitations.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-xs text-ink/45">回答待ちの招待はありません。</div>
        ) : (
          <ol className="mt-3 grid gap-3">
            {invitations.map((invitation) => (
              <li key={invitation.invitationId} className={`rounded-2xl border bg-paper p-4 shadow-sm ${highlightedInvitation === invitation.invitationId ? "border-coral ring-2 ring-coral/15" : "border-line"}`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><Mail size={18} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{invitation.albumName}</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink/55">{invitation.inviterDisplayName}さんから招待されました</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <form action={respondInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.invitationId} />
                    <input type="hidden" name="response" value="declined" />
                    <SharedGroupSubmitButton tone="secondary" pendingLabel="辞退中…" className="w-full">辞退する</SharedGroupSubmitButton>
                  </form>
                  <form action={respondInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.invitationId} />
                    <input type="hidden" name="response" value="accepted" />
                    <SharedGroupSubmitButton pendingLabel="承認中…" className="w-full">承認する</SharedGroupSubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8" aria-labelledby="joined-groups-title">
        <div className="flex items-center justify-between">
          <h2 id="joined-groups-title" className="text-sm font-semibold text-ink">参加中のグループ</h2>
          <span className="text-[11px] text-ink/40">{albums.length}件</span>
        </div>
        {albums.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center">
            <UsersRound className="mx-auto text-coral" size={24} strokeWidth={1.5} />
            <p className="mt-3 text-xs leading-6 text-ink/50">まだ参加しているグループはありません。</p>
          </div>
        ) : (
          <ol className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper">
            {albums.map((album, index) => (
              <li key={album.id} className={index > 0 ? "border-t border-line" : ""}>
                <Link href={`/shared-groups/${album.id}`} className="flex items-center gap-3 px-4 py-4 transition hover:bg-ivory">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><UsersRound size={18} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{album.name}</span>
                  <ChevronRight size={17} className="text-ink/30" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-paper p-5" aria-labelledby="create-group-title">
        <div className="flex items-center gap-2 text-coral"><Plus size={18} /><h2 id="create-group-title" className="text-sm font-semibold text-ink">新しいグループを作る</h2></div>
        <form action={createSharedGroupAction} className="mt-4">
          <label className="block text-xs font-medium text-ink">
            グループ名
            <input name="name" required maxLength={60} disabled={!configured} placeholder="家族の思い出" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm outline-none placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/10 disabled:opacity-50" />
          </label>
          <SharedGroupSubmitButton className="mt-4 w-full">グループを作成</SharedGroupSubmitButton>
        </form>
      </section>
    </div>
  );
}
