"use client";

import { useRef, useState } from "react";
import { Crown, Plus, Settings, ShieldCheck, Trash2, UserRoundPlus } from "lucide-react";
import { SharedGroupDialog } from "@/components/shared-group-dialog";
import { SharedGroupSubmitButton } from "@/components/shared-group-submit-button";
import { MemoryPhoto } from "@/components/memory-photo";
import { formatShortDate } from "@/lib/data";
import type { SharedAlbumMember, SharedMemoryChoice } from "@/lib/supabase/shared-albums";
import {
  addSharedMemoryAction, deleteSharedGroupAction, inviteSharedGroupMemberAction,
  leaveSharedGroupAction, removeSharedGroupMemberAction,
} from "@/app/shared-groups/actions";

const secondaryButton = "min-h-11 rounded-xl border border-line bg-ivory px-4 py-3 text-sm font-semibold transition hover:bg-paper focus-visible:outline-coral disabled:opacity-45";
const dangerButton = "min-h-11 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10 focus-visible:outline-red-500";

type Panel = { kind: "share" | "invite" | "settings" | "delete" | "leave" }
  | { kind: "remove"; member: SharedAlbumMember };
type Props = {
  groupId: string;
  name: string;
  userId: string;
  isOwner: boolean;
  members: SharedAlbumMember[];
  memories: SharedMemoryChoice[];
};

export function SharedGroupControls({ groupId, name, userId, isOwner, members, memories }: Props) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = (kind: "share" | "invite" | "settings", trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelected(new Set());
    setPanel({ kind });
  };
  const close = () => { if (!pendingRef.current) setPanel(null); };
  const submit = (action: (formData: FormData) => Promise<void>) => async (formData: FormData) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    try {
      await action(formData);
    } finally {
      pendingRef.current = false;
      setBusy(false);
      setPanel(null);
    }
  };
  const backToSettings = () => { if (!pendingRef.current) setPanel({ kind: "settings" }); };
  const title = panel?.kind === "share" ? "思い出を共有"
    : panel?.kind === "invite" ? "メンバーを招待"
    : panel?.kind === "remove" ? "メンバーを除外"
    : panel?.kind === "delete" ? "グループを削除"
    : panel?.kind === "leave" ? "グループから退出" : "グループ設定";

  return (
    <>
      <div className="shared-group-heading-actions">
        <button type="button" onClick={(event) => open("settings", event.currentTarget)} aria-haspopup="dialog" className={secondaryButton}><Settings size={20} aria-hidden="true" className="text-coral" />設定</button>
        {isOwner ? <button type="button" onClick={(event) => open("invite", event.currentTarget)} aria-haspopup="dialog" className={secondaryButton}><UserRoundPlus size={20} aria-hidden="true" className="text-coral" />招待</button> : null}
      </div>
      <div className="shared-group-create-fab">
        <button type="button" onClick={(event) => open("share", event.currentTarget)} aria-haspopup="dialog" className="accent-gradient flex h-14 items-center gap-3 whitespace-nowrap rounded-full px-5 text-sm font-semibold text-white shadow-card transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral active:scale-95">
          <Plus size={24} aria-hidden="true" />思い出を共有
        </button>
      </div>
      {panel ? (
        <SharedGroupDialog title={title} subtitle={name} busy={busy} onClose={close} returnFocusRef={triggerRef}>
          {panel.kind === "share" ? (
            <form action={submit(addSharedMemoryAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <p className="text-xs leading-6 text-ink/60">共有する思い出を選んでください。複数選択できます。</p>
              {memories.length === 0 ? <p className="mt-4 rounded-xl bg-paper p-5 text-center text-sm text-ink/60">追加できる思い出はありません。</p> : (
                <fieldset disabled={busy} className="shared-memory-picker mt-3">
                  <legend className="sr-only">共有する思い出</legend>
                  {memories.map((memory) => (
                    <label key={memory.id} className={`shared-memory-choice relative cursor-pointer overflow-hidden rounded-xl border bg-paper ${selected.has(memory.id) ? "border-coral ring-2 ring-coral/25" : "border-line"}`}>
                      <input type="checkbox" name="memoryId" value={memory.id} checked={selected.has(memory.id)} onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setSelected((previous) => {
                          const next = new Set(previous);
                          if (checked) next.add(memory.id); else next.delete(memory.id);
                          return next;
                        });
                      }} className="absolute right-2 top-2 z-10 h-5 w-5 accent-coral" />
                      <div className="aspect-square overflow-hidden"><MemoryPhoto src={memory.displayUrl} alt="" className="h-full w-full object-cover" /></div>
                      <div className="p-2.5">
                        <span className="block text-[11px] text-ink/60">{formatShortDate(memory.date)}</span>
                        <span className="mt-1 line-clamp-2 block text-xs font-semibold leading-5">{memory.caption}</span>
                      </div>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="shared-memory-picker-footer mt-4 border-t border-line pt-3">
                <p role="status" className="mb-3 text-xs text-ink/60">{selected.size}件選択中</p>
                <SharedGroupSubmitButton disabled={busy || selected.size === 0} pendingLabel="共有中…" className="w-full !text-sm">選択した{selected.size}件を共有</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "invite" && isOwner ? (
            <form action={submit(inviteSharedGroupMemberAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <p className="text-sm leading-6 text-ink/70">Memorimberに登録済みのメールアドレスを入力してください。</p>
              <label className="mt-4 block text-sm font-medium">メールアドレス
                <input data-dialog-autofocus type="email" name="email" autoComplete="email" required maxLength={320} disabled={busy} placeholder="friend@example.com" className="mt-2 w-full rounded-xl border border-line bg-ivory px-4 py-3 text-base outline-none placeholder:text-ink/40 focus:border-coral focus:ring-2 focus:ring-coral/10" />
              </label>
              <SharedGroupSubmitButton disabled={busy} pendingLabel="招待中…" className="mt-5 w-full !rounded-full !text-sm">招待を送る</SharedGroupSubmitButton>
            </form>
          ) : null}

          {panel.kind === "settings" ? (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm"><h3 className="font-semibold">メンバー</h3><span className="text-ink/60">{members.length}人</span></div>
              <ul className="mt-3 space-y-2">
                {members.map((member) => (
                  <li key={member.userId} className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2">
                    {member.role === "owner" ? <Crown size={20} className="shrink-0 text-amber-500" aria-hidden="true" /> : <ShieldCheck size={20} className="shrink-0 text-coral" aria-hidden="true" />}
                    <div className="min-w-0 flex-1 basis-28">
                      <p className="break-words text-sm font-medium">{member.displayName}{member.userId === userId ? "（あなた）" : ""}</p>
                      <p className="mt-0.5 text-[10px] text-ink/55">{member.role === "owner" ? "オーナー" : "メンバー"}</p>
                    </div>
                    {isOwner && member.role === "member" ? <button type="button" onClick={() => setPanel({ kind: "remove", member })} className={`${dangerButton} border border-red-500/50`} aria-label={`${member.displayName}を除外`}>除外</button> : null}
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-line pt-3 text-center">
                {isOwner ? <button type="button" onClick={() => setPanel({ kind: "delete" })} className={`${dangerButton} inline-flex items-center gap-2`}><Trash2 size={18} aria-hidden="true" />グループを削除</button>
                  : <button type="button" onClick={() => setPanel({ kind: "leave" })} className={dangerButton}>グループから退出</button>}
              </div>
            </div>
          ) : null}

          {panel.kind === "remove" && isOwner ? (
            <form action={submit(removeSharedGroupMemberAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="userId" value={panel.member.userId} />
              <p className="break-words text-sm leading-6">{panel.member.displayName} をこのグループから除外しますか？</p>
              <p className="mt-2 text-xs leading-6 text-ink/60">このメンバーが共有した思い出もグループから外れます。元の思い出と写真は残ります。</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={backToSettings} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="除外中…">除外する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "delete" && isOwner ? (
            <form action={submit(deleteSharedGroupAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <label className="flex items-start gap-3 text-sm leading-6">
                <input type="checkbox" name="confirm" value="delete" required disabled={busy} className="mt-1 h-5 w-5 shrink-0 accent-red-500" />
                <span>グループを削除することを確認しました。現在のメンバーが所有する元の思い出と写真は残ります。退会者の保持写真は、最後の共有先がなくなると削除されます。</span>
              </label>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={backToSettings} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="削除中…">削除する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}

          {panel.kind === "leave" && !isOwner ? (
            <form action={submit(leaveSharedGroupAction)} className="mt-4">
              <input type="hidden" name="groupId" value={groupId} />
              <fieldset disabled={busy}>
                <legend className="text-sm font-semibold">退出後の自分の写真</legend>
                <label className="mt-4 flex items-start gap-2 text-xs leading-6"><input type="radio" name="memoryHandling" value="keep" defaultChecked className="mt-1 accent-coral" /><span><strong className="block">共有したまま残す（おすすめ）</strong>メンバーは引き続き閲覧できます。</span></label>
                <label className="mt-3 flex items-start gap-2 text-xs leading-6"><input type="radio" name="memoryHandling" value="remove" className="mt-1 accent-coral" /><span><strong className="block">グループから外す</strong>共有関係だけを解除し、元の思い出と写真は残します。</span></label>
              </fieldset>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button type="button" disabled={busy} onClick={backToSettings} className={secondaryButton}>キャンセル</button>
                <SharedGroupSubmitButton tone="danger" disabled={busy} pendingLabel="退出中…">退出する</SharedGroupSubmitButton>
              </div>
            </form>
          ) : null}
        </SharedGroupDialog>
      ) : null}
    </>
  );
}
