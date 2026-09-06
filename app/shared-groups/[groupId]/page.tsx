import { Gamepad2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppBackLink } from "@/components/app-back-link";
import { AppHeader } from "@/components/app-header";
import { ProfileLevelActivityMarker } from "@/components/profile-level-activity-marker";
import { SharedGroupControls, SharedMemoryShareButton } from "@/components/shared-group-controls";
import { SharedGroupIcon } from "@/components/shared-group-icon";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { SharedMemoryGallery } from "@/components/shared-memory-gallery";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getSharedAlbum,
  isUuid,
  listOwnMemoriesForSharing,
  listSharedAlbumMembers,
  loadSharedAlbumMemoryEntries,
  type SharedAlbumMember,
  type SharedAlbumMemoryEntry,
  type SharedMemoryChoice,
} from "@/lib/supabase/shared-albums";
import { createClient } from "@/lib/supabase/server";
import { joinSharedQuizAction } from "../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SharedGroupDetailPage({ params, searchParams }: PageProps) {
  const [{ groupId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(groupId)) notFound();
  const success = typeof query.success === "string" ? query.success : null;
  const actionError = typeof query.error === "string" ? query.error : null;
  const sharedMemoryActivityId = query.activity === "shared-memory" && typeof query.activityId === "string"
    ? query.activityId.slice(0, 120)
    : null;
  const sharedMemoryActivityCount = typeof query.activityCount === "string" ? Number(query.activityCount) : 0;

  if (!isSupabaseConfigured()) {
    return (
      <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--info mt-8">Supabaseの接続情報が設定されていません。</p></div>
    );
  }

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?${new URLSearchParams({ next: `/shared-groups/${groupId}` })}`);

  let album;
  try {
    album = await getSharedAlbum(client, groupId);
  } catch (error) {
    return (
      <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--error mt-8">{error instanceof Error ? error.message : "グループを読み込めませんでした。"}</p></div>
    );
  }
  if (!album) notFound();

  let members: SharedAlbumMember[] = [];
  let entries: SharedAlbumMemoryEntry[] = [];
  let ownMemories: SharedMemoryChoice[] = [];
  let imageWarning: string | null = null;
  let loadError: string | null = null;
  const [memberResult, memoryResult, ownMemoryResult] = await Promise.allSettled([
    listSharedAlbumMembers(client, groupId),
    loadSharedAlbumMemoryEntries(client, groupId),
    listOwnMemoriesForSharing(client, user.id),
  ]);
  if (memberResult.status === "fulfilled") members = memberResult.value;
  else loadError = memberResult.reason instanceof Error ? memberResult.reason.message : "メンバーを読み込めませんでした。";
  if (memoryResult.status === "fulfilled") {
    entries = memoryResult.value.entries;
    imageWarning = memoryResult.value.warning;
  } else loadError ??= memoryResult.reason instanceof Error ? memoryResult.reason.message : "共有された思い出を読み込めませんでした。";
  if (ownMemoryResult.status === "fulfilled") {
    ownMemories = ownMemoryResult.value;
  } else loadError ??= ownMemoryResult.reason instanceof Error ? ownMemoryResult.reason.message : "自分の思い出を読み込めませんでした。";

  const isOwner = album.ownerId === user.id;
  const sharedIds = new Set(entries.map((entry) => entry.memory.id));
  const availableMemories = ownMemories.filter((memory) => !sharedIds.has(memory.id));

  return (
    <div className="page-pad shared-groups-page">
      {isOwner && success === "グループを作成しました。" ? (
        <ProfileLevelActivityMarker metric="createdGroups" eventId={groupId} />
      ) : null}
      {sharedMemoryActivityId && Number.isInteger(sharedMemoryActivityCount) && sharedMemoryActivityCount > 0 ? (
        <ProfileLevelActivityMarker
          metric="sharedMemories"
          eventId={sharedMemoryActivityId}
          amount={sharedMemoryActivityCount}
        />
      ) : null}
      <AppHeader />
      <AppBackLink href="/shared-groups" label="共有一覧へ戻る" />

      <section className="shared-group-heading mt-7">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-5 tracking-[0.14em] text-coral">SHARED GROUP</p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <SharedGroupIcon groupId={groupId} size="large" />
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-[28px] font-bold leading-[1.35] tracking-[0.04em]">{album.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/55">
                <span>{members.length}人のメンバー</span>
                <span>{entries.length}枚の写真</span>
              </p>
            </div>
          </div>
        </div>
        <SharedGroupControls
          groupId={groupId}
          name={album.name}
          userId={user.id}
          isOwner={isOwner}
          members={members}
        />
      </section>

      {success ? <p role="status" className="auth-notice auth-notice--success mt-6">{success}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {loadError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{loadError}</p> : null}
      {imageWarning ? <p role="status" className="auth-notice auth-notice--info mt-6">{imageWarning}</p> : null}

      <section className="mt-7 rounded-2xl border border-coral/20 bg-paper p-4 shadow-sm" aria-labelledby="shared-quiz-title">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><Gamepad2 size={20} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold tracking-[0.16em] text-coral/75">GROUP QUIZ</p>
            <h2 id="shared-quiz-title" className="mt-0.5 text-base font-bold text-ink">みんなでクイズ</h2>
          </div>
          <form action={joinSharedQuizAction} className="shrink-0">
            <input type="hidden" name="groupId" value={groupId} />
            <SharedGroupSubmitButton disabled={entries.length === 0} pendingLabel="参加中…" className="min-h-10 whitespace-nowrap !rounded-full !px-4 text-xs">クイズに参加</SharedGroupSubmitButton>
          </form>
        </div>
        {entries.length === 0 ? <p className="mt-3 text-center text-[10px] text-ink/45">思い出を1件以上共有すると参加できます。</p> : null}
      </section>

      <section className="mt-7 border-t border-line pt-5" aria-labelledby="shared-memories-title">
        <div className="flex min-h-12 items-center justify-between px-1">
          <h2 id="shared-memories-title" className="text-sm font-semibold text-ink">共有された思い出</h2>
          <SharedMemoryShareButton groupId={groupId} name={album.name} memories={availableMemories} />
        </div>
        {entries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-xs leading-6 text-ink/45">まだ思い出は共有されていません。</div>
        ) : <SharedMemoryGallery groupId={groupId} entries={entries} userId={user.id} isOwner={isOwner} />}
      </section>
    </div>
  );
}
