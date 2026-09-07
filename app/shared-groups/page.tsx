import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageHeading } from "@/components/page-heading";
import { ProfileLevelActivityTotalsMarker } from "@/components/profile-level-activity-marker";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { SharedGroupCreateButton } from "@/components/shared-group-create-button";
import { SharedGroupIcon } from "@/components/shared-group-icon";
import { SharedMemberName } from "@/components/shared-member-identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listInvitationNotifications, type InvitationNotification } from "@/lib/supabase/shared-album-invitations";
import { listSharedAlbums, type SharedAlbum, type SharedAlbumMember } from "@/lib/supabase/shared-albums";
import { getGroupProfiles } from "@/lib/supabase/group-profiles";
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
  const membersByAlbumId = new Map<string, SharedAlbumMember[]>();
  let invitations: InvitationNotification[] = [];
  let loadError: string | null = null;
  let currentUserId: string | null = null;
  let groupSnapshotReady = false;

  if (configured) {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) redirect(`/login?${new URLSearchParams({ next: "/shared-groups" })}`);
    currentUserId = user.id;
    const [albumResult, invitationResult] = await Promise.allSettled([
      listSharedAlbums(client),
      listInvitationNotifications(client),
    ]);
    if (albumResult.status === "fulfilled") {
      albums = albumResult.value;
      const memberResults = await Promise.allSettled(albums.map((album) => getGroupProfiles(client, album.id, undefined, false)));
      memberResults.forEach((result, index) => {
        if (result.status === "fulfilled") membersByAlbumId.set(albums[index].id, result.value ?? []);
        else loadError ??= result.reason instanceof Error ? result.reason.message : "メンバーを読み込めませんでした。";
      });
      groupSnapshotReady = memberResults.every((result) => result.status === "fulfilled");
    } else loadError = albumResult.reason instanceof Error ? albumResult.reason.message : "グループを読み込めませんでした。";
    if (invitationResult.status === "fulfilled") {
      invitations = invitationResult.value.filter((invitation) => invitation.status === "pending");
    } else {
      loadError ??= invitationResult.reason instanceof Error ? invitationResult.reason.message : "招待を読み込めませんでした。";
    }
  }

  const connectedPeople = new Set(
    [...membersByAlbumId.values()].flatMap((members) =>
      members.filter((member) => member.userId !== currentUserId).map((member) => member.userId),
    ),
  ).size;

  return (
    <div className="page-pad shared-groups-page">
      {groupSnapshotReady ? (
        <ProfileLevelActivityTotalsMarker values={{ joinedGroups: albums.length, connectedPeople }} />
      ) : null}
      <AppHeader />
      <PageHeading eyebrow="SHARED GROUPS" title="共有" />

      {!configured ? <p role="alert" className="auth-notice auth-notice--info mt-6">Supabaseの接続情報が設定されていません。</p> : null}
      {success ? <p role="status" className="auth-notice auth-notice--success mt-6">{success}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {loadError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{loadError}</p> : null}

      {invitations.length > 0 ? <section className="mt-7" aria-labelledby="pending-invitations-title">
        <div className="flex items-center justify-between">
          <h2 id="pending-invitations-title" className="text-sm font-semibold text-ink">届いている招待</h2>
          <span className="text-[11px] text-ink/40">{invitations.length}件</span>
        </div>
        <ol className="mt-3 grid gap-3">
          {invitations.map((invitation) => (
            <li key={invitation.invitationId} className={`flex items-center gap-3 rounded-2xl border bg-paper p-3 shadow-sm ${highlightedInvitation === invitation.invitationId ? "border-coral ring-2 ring-coral/15" : "border-line"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink" title={invitation.albumName}>{invitation.albumName}</p>
                <p className="mt-1 truncate text-[11px] text-ink/55" title={`${invitation.inviterDisplayName}さんからの招待`}>{invitation.inviterDisplayName}さんからの招待</p>
              </div>
              <div className="shared-group-invitation-responses flex shrink-0 items-center gap-2">
                <form action={respondInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.invitationId} />
                  <input type="hidden" name="response" value="declined" />
                  <SharedGroupSubmitButton tone="secondary" pendingLabel="辞退中…">辞退</SharedGroupSubmitButton>
                </form>
                <form action={respondInvitationAction}>
                  <input type="hidden" name="invitationId" value={invitation.invitationId} />
                  <input type="hidden" name="response" value="accepted" />
                  <SharedGroupSubmitButton pendingLabel="承認中…">承認</SharedGroupSubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ol>
      </section> : null}

      <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-paper shadow-sm" aria-labelledby="joined-groups-title">
        <div className="flex min-h-14 items-center justify-between border-b border-line/70 px-4 py-2">
          <h2 id="joined-groups-title" className="text-sm font-semibold text-ink">参加中のグループ</h2>
          <SharedGroupCreateButton configured={configured} createAction={createSharedGroupAction} />
        </div>
        {albums.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <UsersRound className="mx-auto text-coral" size={24} strokeWidth={1.5} />
            <p className="mt-3 text-xs leading-6 text-ink/50">まだ参加しているグループはありません。</p>
          </div>
        ) : (
          <ol>
            {albums.map((album, index) => {
              const groupMembers = membersByAlbumId.get(album.id) ?? [];
              const memberNames = groupMembers.map((member) => `${member.displayName} Lv.${member.level ?? 1}`).join(" · ");
              return <li key={album.id} className={index > 0 ? "border-t border-line/70" : ""}>
                <Link href={`/shared-groups/${album.id}`} className="group flex min-h-[68px] items-center gap-3 px-4 py-3 transition hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-coral/40">
                  <SharedGroupIcon groupId={album.id} />
                  <span className="flex min-w-0 flex-1 items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{album.name}</span>
                    {memberNames ? (
                      <span className="max-w-[52%] shrink-0 truncate text-[10px] text-ink/40" title={memberNames} aria-label={`メンバー: ${memberNames}`}>
                        {groupMembers.map((member, memberIndex) => (
                          <span key={member.userId}>
                            {memberIndex ? " · " : ""}
                            <SharedMemberName displayName={member.displayName} level={member.level} isCurrentUser={member.userId === currentUserId} />
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-ink/25 transition group-hover:translate-x-0.5 group-hover:text-coral/60" />
                </Link>
              </li>;
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
