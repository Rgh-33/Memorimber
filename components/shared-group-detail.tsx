"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Gamepad2 } from "lucide-react";
import { AppBackLink } from "@/components/app-back-link";
import { AppHeader } from "@/components/app-header";
import { SharedGroupControls, SharedMemoryShareButton } from "@/components/shared-group-controls";
import { SharedGroupIcon } from "@/components/shared-group-icon";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { SharedMemoryGallery } from "@/components/shared-memory-gallery";
import { joinSharedQuizAction } from "@/app/shared-groups/actions";
import { useMemories } from "@/lib/memories-context";
import { getMemoryDisplayUrl } from "@/lib/types";
import { getGroupCache, getEmptyGroupCache, subscribeGroupCache, watchGroup } from "@/lib/shared-group-cache";
import type { SharedAlbum } from "@/lib/supabase/shared-albums";

export function SharedGroupDetail({ initialAlbum, userId, success, actionError }: { initialAlbum: SharedAlbum; userId: string; success: string | null; actionError: string | null }) {
  const groupId = initialAlbum.id;
  const cached = useSyncExternalStore(subscribeGroupCache, () => getGroupCache(groupId), getEmptyGroupCache);
  const { memories } = useMemories();
  useEffect(() => watchGroup(groupId, true), [groupId, initialAlbum]);
  const album = cached.album ?? initialAlbum;
  const members = cached.members ?? [];
  const entries = cached.photos?.entries ?? [];
  const imageWarning = cached.photos?.warning;
  const loadError = cached.error;
  const isOwner = album.ownerId === userId;
  const sharedIds = new Set(entries.map((entry) => entry.memory.id));
  const availableMemories = memories.filter((memory) => !sharedIds.has(memory.id)).map((memory) => ({ id: memory.id, caption: memory.caption, date: memory.date, displayUrl: getMemoryDisplayUrl(memory) }));
  if (cached.forbidden) return <div className="page-pad"><AppHeader /><p role="alert" className="auth-notice auth-notice--error mt-8">{loadError}</p></div>;
  return (
    <div className="page-pad shared-groups-page">
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
          userId={userId}
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
        ) : <SharedMemoryGallery groupId={groupId} entries={entries} userId={userId} isOwner={isOwner} />}
      </section>
    </div>
  );
}
