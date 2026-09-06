import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MemoryPhoto } from "@/components/memory-photo";
import { SharedGroupControls } from "@/components/shared-group-controls";
import { SharedMemoryMenu } from "@/components/shared-memory-menu";
import { formatShortDate } from "@/lib/data";
import { getMemoryDisplayUrl } from "@/lib/types";
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
  const memberNames = new Map(members.map((member) => [member.userId, member.displayName]));

  return (
    <div className="page-pad shared-groups-page">
      <AppHeader />
      <Link href="/shared-groups" className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />共有一覧へ</Link>

      <section className="shared-group-heading mt-7">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-5 tracking-[0.14em] text-coral">SHARED GROUP</p>
          <h1 className="mt-2 break-words text-[28px] font-bold leading-[1.4] tracking-[0.04em]">{album.name}</h1>
          <p className="mt-2 text-sm text-ink/55">{members.length}人のメンバー</p>
        </div>
        <SharedGroupControls groupId={groupId} name={album.name} userId={user.id} isOwner={isOwner} members={members} memories={availableMemories} />
      </section>

      {success ? <p role="status" className="auth-notice auth-notice--success mt-6">{success}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {loadError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{loadError}</p> : null}
      {imageWarning ? <p role="status" className="auth-notice auth-notice--info mt-6">{imageWarning}</p> : null}

      <section className="mt-8" aria-labelledby="shared-memories-title">
        <div className="flex items-center justify-between">
          <h2 id="shared-memories-title" className="text-lg font-bold text-ink">共有された思い出</h2>
          <span className="text-[11px] text-ink/40">{entries.length}件</span>
        </div>
        {entries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-xs leading-6 text-ink/45">まだ思い出は共有されていません。</div>
        ) : (
          <ol className="mt-3 grid grid-cols-2 gap-3">
            {entries.map((entry) => {
              const canRemove = isOwner || entry.addedBy === user.id;
              return (
                <li key={entry.memory.id} className="min-w-0 rounded-2xl border border-line bg-paper shadow-sm">
                  <Link href={`/shared-groups/${groupId}/memories/${entry.memory.id}`} className="group block">
                    <div className="aspect-square overflow-hidden rounded-t-2xl bg-ivory">
                      <MemoryPhoto src={getMemoryDisplayUrl(entry.memory)} alt={entry.memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-semibold leading-5 text-ink">{entry.memory.caption}</p>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-1 px-3 pb-3">
                    <p className="min-w-0 break-words text-[11px] text-ink/55">{formatShortDate(entry.memory.date)} · {entry.contributorName ?? memberNames.get(entry.addedBy ?? "") ?? "メンバー"}</p>
                    {canRemove ? <SharedMemoryMenu groupId={groupId} memoryId={entry.memory.id} caption={entry.memory.caption} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
