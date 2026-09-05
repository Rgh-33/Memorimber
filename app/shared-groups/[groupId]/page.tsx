import Link from "next/link";
import { ArrowLeft, Crown, Mail, ShieldCheck, Trash2, UserMinus, UsersRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { MemoryPhoto } from "@/components/memory-photo";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { formatShortDate } from "@/lib/data";
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
import {
  addSharedMemoryAction,
  deleteSharedGroupAction,
  inviteSharedGroupMemberAction,
  leaveSharedGroupAction,
  removeSharedGroupMemberAction,
  removeSharedMemoryAction,
} from "../actions";

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
    <div className="page-pad">
      <AppHeader />
      <Link href="/shared-groups" className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink/55 hover:text-coral"><ArrowLeft size={15} />共有一覧へ</Link>

      <section className="mt-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-coral/10 text-coral"><UsersRound size={22} /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-coral">SHARED GROUP</p>
            <h1 className="mt-1 break-words text-2xl font-semibold leading-9 text-ink">{album.name}</h1>
            <p className="mt-1 text-[11px] text-ink/45">{members.length}人のメンバー</p>
          </div>
        </div>
      </section>

      {success ? <p role="status" className="auth-notice auth-notice--success mt-6">{success}</p> : null}
      {actionError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{actionError}</p> : null}
      {loadError ? <p role="alert" className="auth-notice auth-notice--error mt-6">{loadError}</p> : null}
      {imageWarning ? <p role="status" className="auth-notice auth-notice--info mt-6">{imageWarning}</p> : null}

      <section className="mt-8" aria-labelledby="shared-memories-title">
        <div className="flex items-center justify-between">
          <h2 id="shared-memories-title" className="text-sm font-semibold text-ink">共有された思い出</h2>
          <span className="text-[11px] text-ink/40">{entries.length}件</span>
        </div>
        {entries.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-center text-xs leading-6 text-ink/45">まだ思い出は共有されていません。</div>
        ) : (
          <ol className="mt-3 grid grid-cols-2 gap-3">
            {entries.map((entry) => {
              const canRemove = isOwner || entry.addedBy === user.id;
              return (
                <li key={entry.memory.id} className="overflow-hidden rounded-2xl border border-line bg-paper shadow-sm">
                  <Link href={`/shared-groups/${groupId}/memories/${entry.memory.id}`} className="group block">
                    <div className="aspect-square overflow-hidden bg-ivory">
                      <MemoryPhoto src={entry.memory.imageUrl} alt={entry.memory.caption} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-xs font-semibold leading-5 text-ink">{entry.memory.caption}</p>
                      <p className="mt-1 text-[10px] text-ink/45">{formatShortDate(entry.memory.date)} · {memberNames.get(entry.addedBy) ?? "メンバー"}</p>
                    </div>
                  </Link>
                  {canRemove ? (
                    <form action={removeSharedMemoryAction} className="border-t border-line p-2">
                      <input type="hidden" name="groupId" value={groupId} />
                      <input type="hidden" name="memoryId" value={entry.memory.id} />
                      <SharedGroupSubmitButton tone="secondary" pendingLabel="解除中…" className="w-full py-2">共有を解除</SharedGroupSubmitButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-paper p-5" aria-labelledby="add-memory-title">
        <h2 id="add-memory-title" className="text-sm font-semibold text-ink">自分の思い出を共有する</h2>
        <p className="mt-2 text-[11px] leading-5 text-ink/50">自分が所有する思い出だけ追加できます。元の写真や一言は複製されません。</p>
        {availableMemories.length === 0 ? (
          <p className="mt-4 rounded-xl bg-ivory px-4 py-4 text-center text-xs text-ink/45">追加できる思い出はありません。</p>
        ) : (
          <form action={addSharedMemoryAction} className="mt-4">
            <input type="hidden" name="groupId" value={groupId} />
            <label className="block text-xs font-medium text-ink">
              思い出を選択
              <select name="memoryId" required className="mt-2 w-full rounded-xl border border-line bg-ivory px-3 py-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/10">
                {availableMemories.map((memory) => <option key={memory.id} value={memory.id}>{formatShortDate(memory.date)}　{memory.caption}</option>)}
              </select>
            </label>
            <SharedGroupSubmitButton className="mt-3 w-full">この思い出を共有</SharedGroupSubmitButton>
          </form>
        )}
      </section>

      <section className="mt-8" aria-labelledby="members-title">
        <div className="flex items-center justify-between">
          <h2 id="members-title" className="text-sm font-semibold text-ink">メンバー</h2>
          <span className="text-[11px] text-ink/40">ユーザー名で表示</span>
        </div>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-line bg-paper">
          {members.map((member, index) => (
            <li key={member.userId} className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? "border-t border-line" : ""}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ivory text-coral">{member.role === "owner" ? <Crown size={17} /> : <ShieldCheck size={17} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{member.displayName}{member.userId === user.id ? "（あなた）" : ""}</span>
                <span className="mt-0.5 block text-[10px] text-ink/40">{member.role === "owner" ? "オーナー" : "メンバー"}</span>
              </span>
              {isOwner && member.role === "member" ? (
                <form action={removeSharedGroupMemberAction}>
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="hidden" name="userId" value={member.userId} />
                  <SharedGroupSubmitButton tone="danger" pendingLabel="除外中…" className="px-3 py-2"><span className="flex items-center gap-1"><UserMinus size={14} />除外</span></SharedGroupSubmitButton>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {isOwner ? (
        <section className="mt-8 rounded-2xl border border-line bg-paper p-5" aria-labelledby="invite-title">
          <div className="flex items-center gap-2"><Mail size={17} className="text-coral" /><h2 id="invite-title" className="text-sm font-semibold text-ink">メールで招待</h2></div>
          <p className="mt-2 text-[11px] leading-5 text-ink/50">Memorimberに登録済みのメールアドレスを入力してください。</p>
          <form action={inviteSharedGroupMemberAction} className="mt-4">
            <input type="hidden" name="groupId" value={groupId} />
            <label className="block text-xs font-medium text-ink">メールアドレス
              <input type="email" name="email" autoComplete="email" required maxLength={320} placeholder="friend@example.com" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-sm outline-none placeholder:text-ink/30 focus:border-coral focus:ring-2 focus:ring-coral/10" />
            </label>
            <SharedGroupSubmitButton className="mt-3 w-full">招待を送る</SharedGroupSubmitButton>
          </form>
        </section>
      ) : null}

      <section className="mt-8 rounded-2xl border border-red-200/70 bg-red-50/50 p-5" aria-labelledby="group-management-title">
        <h2 id="group-management-title" className="text-sm font-semibold text-ink">グループの管理</h2>
        {isOwner ? (
          <form action={deleteSharedGroupAction} className="mt-4">
            <input type="hidden" name="groupId" value={groupId} />
            <label className="flex items-start gap-2 text-[11px] leading-5 text-ink/65">
              <input type="checkbox" name="confirm" value="delete" required className="mt-1 accent-red-500" />
              グループを削除することを確認しました。共有関係だけが消え、元の思い出と写真は残ります。
            </label>
            <SharedGroupSubmitButton tone="danger" pendingLabel="削除中…" className="mt-3 w-full"><span className="flex items-center justify-center gap-2"><Trash2 size={15} />グループを削除</span></SharedGroupSubmitButton>
          </form>
        ) : (
          <form action={leaveSharedGroupAction} className="mt-4">
            <input type="hidden" name="groupId" value={groupId} />
            <fieldset>
              <legend className="text-xs font-medium text-ink">退出後の自分の写真</legend>
              <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink/65"><input type="radio" name="memoryHandling" value="keep" defaultChecked className="mt-1 accent-coral" /><span><strong className="block text-ink">共有したまま残す（おすすめ）</strong>メンバーは引き続き閲覧できます。</span></label>
              <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink/65"><input type="radio" name="memoryHandling" value="remove" className="mt-1 accent-coral" /><span><strong className="block text-ink">グループから外す</strong>共有関係だけを解除し、元の思い出と写真は残します。</span></label>
            </fieldset>
            <SharedGroupSubmitButton tone="danger" pendingLabel="退出中…" className="mt-4 w-full">グループから退出</SharedGroupSubmitButton>
          </form>
        )}
      </section>
    </div>
  );
}
